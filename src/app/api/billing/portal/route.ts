import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { billingEnabled } from "@/lib/plans";

export const dynamic = "force-dynamic";

// POST /api/billing/portal
// Body: { firebaseUid: string }
// Creates a Stripe Customer Portal session for managing the existing
// subscription (upgrade, downgrade, cancel, update payment method).
// Returns 503 { error: "billing_disabled" } when billing is off.
// Returns 404 if the user has no stripeCustomerId yet.
// On success returns { url: string }.
export async function POST(req: Request) {
  if (!billingEnabled()) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { firebaseUid } = body as { firebaseUid?: string };
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] stripe error:", err);
    return NextResponse.json(
      { error: "stripe_error", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
