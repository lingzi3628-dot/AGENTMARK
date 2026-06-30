import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { billingEnabled } from "@/lib/plans";

export const dynamic = "force-dynamic";

// POST /api/billing/checkout
// Body: { firebaseUid: string, priceId: string }
//   - priceId may be either:
//     (a) the literal Stripe price ID (must match STRIPE_PRICE_PRO or STRIPE_PRICE_TEAM env var), OR
//     (b) the plan id "pro" / "team" (resolved server-side to the env var).
// Returns 503 { error: "billing_disabled" } when STRIPE_SECRET_KEY is not set.
// Returns 400 if the priceId doesn't resolve to a configured plan price.
// On success returns { url: string } so the client can redirect.
export async function POST(req: Request) {
  if (!billingEnabled()) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { firebaseUid, priceId } = body as { firebaseUid?: string; priceId?: string };
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  }
  if (!priceId) {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  // Resolve the incoming priceId → actual Stripe price ID via env vars.
  // Accepts either the plan id ("pro" / "team") or a direct Stripe price ID
  // that matches one of the two configured env vars.
  const proPrice = process.env.STRIPE_PRICE_PRO || "";
  const teamPrice = process.env.STRIPE_PRICE_TEAM || "";
  let resolvedPriceId: string | null = null;

  if (priceId === "pro" || priceId === proPrice) {
    resolvedPriceId = proPrice || null;
  } else if (priceId === "team" || priceId === teamPrice) {
    resolvedPriceId = teamPrice || null;
  }

  if (!resolvedPriceId) {
    return NextResponse.json({ error: "unknown_price" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      client_reference_id: firebaseUid,
      customer_email: user.email || undefined,
      ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : {}),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?billing=cancel`,
      metadata: {
        firebaseUid,
        priceId: resolvedPriceId,
      },
      subscription_data: {
        metadata: {
          firebaseUid,
          priceId: resolvedPriceId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout] stripe error:", err);
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
