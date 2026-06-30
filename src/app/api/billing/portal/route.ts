import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Cancel the current subscription (downgrade to free at end of billing period).
// Paystack doesn't have a customer portal like Stripe — this endpoint lets the user
// cancel directly from our UI. Requires the Paystack subscription code + email token
// which we'd need to fetch from Paystack's API or store during checkout.
//
// For now, we implement a simple "cancel" that immediately downgrades the user.
// In production, you'd want to call disableSubscription() in paystack.ts to stop
// future charges too.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  if (!uid) return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (user.plan === "free") {
    return NextResponse.json({ error: "already on free plan" }, { status: 400 });
  }

  // Downgrade to free immediately
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

  // TODO: also call Paystack disableSubscription() to stop future charges.
  // This requires storing the subscription code + email token from the webhook payload.

  return NextResponse.json({ ok: true, plan: "free" });
}
