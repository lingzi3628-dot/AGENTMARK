import { NextResponse } from "next/server";
import { billingEnabled } from "@/lib/plans";

export const dynamic = "force-dynamic";

// GET /api/billing/status
// Returns whether Stripe billing is enabled (i.e. STRIPE_SECRET_KEY is set).
// The client uses this to decide whether to show "Upgrade" buttons or
// "Coming soon" disabled state.
export async function GET() {
  return NextResponse.json({ enabled: billingEnabled() });
}
