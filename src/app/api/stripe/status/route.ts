import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripeEnabled, createLoginLink } from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

// GET /api/stripe/status?uid=<firebaseUid>
// Returns whether the user has Stripe connected + their account status.
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const connection = await db.stripeConnection.findUnique({
    where: { userId: user.id },
  });

  if (!connection) {
    return NextResponse.json({ enabled: stripeEnabled(), connected: false });
  }

  // Generate a Stripe Express login link for the user to manage their account
  let loginUrl: string | null = null;
  if (stripeEnabled()) {
    try {
      loginUrl = await createLoginLink(connection.stripeAccountId);
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({
    enabled: stripeEnabled(),
    connected: true,
    connection: {
      id: connection.id,
      email: connection.email,
      displayName: connection.displayName,
      country: connection.country,
      chargesEnabled: connection.chargesEnabled,
      detailsSubmitted: connection.detailsSubmitted,
    },
    loginUrl,
  });
}
