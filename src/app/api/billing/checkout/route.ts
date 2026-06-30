import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { initializeTransaction, generateReference, paystackEnabled } from "@/lib/paystack";
import { getPlan, priceIdForPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Initialize a Paystack checkout session.
// Body: { firebaseUid, planId } where planId is "pro" or "team".
export async function POST(req: NextRequest) {
  if (!paystackEnabled()) {
    return NextResponse.json(
      { error: "billing_disabled", message: "Paystack is not configured yet — coming soon!" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  const planId = body.planId as "pro" | "team";

  if (!uid || !planId) {
    return NextResponse.json({ error: "firebaseUid and planId are required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const plan = getPlan(planId);
  if (plan.id === "free") {
    return NextResponse.json({ error: "cannot upgrade to free plan" }, { status: 400 });
  }

  // Amount in USD cents (Paystack expects smallest currency unit)
  const amountCents = Math.round(plan.priceUsd * 100);
  const reference = generateReference("am_sub");

  // Build callback URL (where Paystack redirects after checkout)
  const host = req.nextUrl.searchParams.get("host") || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const callbackUrl = `${host}/billing/verify?reference=${reference}`;

  // Look up the Paystack plan code from env vars (set in Paystack dashboard)
  const planCode = priceIdForPlan(planId);

  try {
    const result = await initializeTransaction({
      email: user.email,
      amount: amountCents,
      reference,
      callbackUrl,
      metadata: {
        custom_fields: [
          { display_name: "Plan", variable_name: "plan", value: planId },
          { display_name: "User ID", variable_name: "user_id", value: user.id },
          { display_name: "Firebase UID", variable_name: "firebase_uid", value: uid },
        ],
      },
      ...(planCode ? { plan: planCode } : {}),
    });

    if (!result.status) {
      return NextResponse.json({ error: result.message || "Paystack init failed" }, { status: 502 });
    }

    return NextResponse.json({
      url: result.data.authorization_url,
      reference: result.data.reference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
