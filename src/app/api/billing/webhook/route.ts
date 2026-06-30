import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, paystackEnabled } from "@/lib/paystack";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Paystack webhook receiver.
// Paystack sends events to this URL (configured in Paystack dashboard).
// We handle: charge.success (one-time or first subscription payment),
// subscription.create, subscription.disable, subscription.expiring.
export async function POST(req: NextRequest) {
  if (!paystackEnabled()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";

  // Verify HMAC-SHA512 signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = event.event;
  const data = event.data;

  try {
    if (eventType === "charge.success") {
      // Successful payment (one-time or first subscription charge)
      const customerEmail = (data.customer as { email: string })?.email;
      const reference = data.reference as string;
      const planId = ((data.metadata as { custom_fields?: { variable_name: string; value: string }[] })
        ?.custom_fields?.find((f) => f.variable_name === "plan")?.value) as "pro" | "team" | undefined;

      if (customerEmail && planId) {
        const plan = getPlan(planId);
        const user = await db.user.findFirst({ where: { email: customerEmail } });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: planId,
              maxAgents: plan.maxAgents,
              dailyTokenLimit: plan.dailyTokenLimit,
              stripeCustomerId: (data.customer as { customer_code: string })?.customer_code || user.stripeCustomerId,
              stripePriceId: plan.id,
              stripeSubscriptionId: reference,
            },
          });
        }
      }
    } else if (eventType === "subscription.disable") {
      // Subscription cancelled — downgrade to free
      const customerEmail = (data.customer as { email: string })?.email;
      if (customerEmail) {
        const user = await db.user.findFirst({ where: { email: customerEmail } });
        if (user) {
          const freePlan = getPlan("free");
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: "free",
              maxAgents: freePlan.maxAgents,
              dailyTokenLimit: freePlan.dailyTokenLimit,
              stripeSubscriptionId: "",
            },
          });
        }
      }
    }
    // Other events (subscription.create, subscription.charge, etc.) — we acknowledge but don't act.
    // The charge.success event covers the main use case.

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[billing/webhook] error processing event:", eventType, err);
    // Return 200 anyway so Paystack doesn't retry indefinitely
    return NextResponse.json({ received: true, error: "processing failed" });
  }
}
