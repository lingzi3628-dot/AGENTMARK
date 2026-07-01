import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getStripe,
  stripeEnabled,
  buildConnectUrl,
  exchangeConnectCode,
  getAccountDetails,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

// GET /api/stripe/connect?uid=<firebaseUid>
// Returns the Stripe OAuth URL to redirect the user to.
export async function GET(req: NextRequest) {
  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_CONNECT_CLIENT_ID env vars." },
      { status: 503 },
    );
  }

  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // If already connected, return the connection status
  const existing = await db.stripeConnection.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    // Refresh account details
    try {
      const details = await getAccountDetails(existing.stripeAccountId);
      const updated = await db.stripeConnection.update({
        where: { id: existing.id },
        data: {
          email: details.email,
          displayName: details.displayName,
          country: details.country,
          chargesEnabled: details.chargesEnabled,
          detailsSubmitted: details.detailsSubmitted,
        },
      });
      return NextResponse.json({
        connected: true,
        connection: {
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          country: updated.country,
          chargesEnabled: updated.chargesEnabled,
          detailsSubmitted: updated.detailsSubmitted,
        },
      });
    } catch {
      // If refresh fails, return existing data
      return NextResponse.json({
        connected: true,
        connection: {
          id: existing.id,
          email: existing.email,
          displayName: existing.displayName,
          country: existing.country,
          chargesEnabled: existing.chargesEnabled,
          detailsSubmitted: existing.detailsSubmitted,
        },
      });
    }
  }

  // Build OAuth URL
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const redirectUri = `${proto}://${host}/api/stripe/connect`;

  const state = `${user.id}:${Math.random().toString(36).slice(2, 10)}`;
  const authUrl = buildConnectUrl(state, redirectUri);

  return NextResponse.json({ connected: false, authUrl, state });
}

// POST /api/stripe/connect — handle the OAuth callback (code exchange)
// Body: { code, uid }
export async function POST(req: NextRequest) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const code = body.code as string;
  const uid = body.uid as string;

  if (!code || !uid) {
    return NextResponse.json({ error: "code and uid required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    // Exchange the code for a Stripe account ID
    const tokenData = await exchangeConnectCode(code);

    // Fetch account details
    const details = await getAccountDetails(tokenData.stripe_user_id);

    // Upsert the connection
    const connection = await db.stripeConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeAccountId: tokenData.stripe_user_id,
        email: details.email,
        displayName: details.displayName,
        country: details.country,
        chargesEnabled: details.chargesEnabled,
        detailsSubmitted: details.detailsSubmitted,
      },
      update: {
        stripeAccountId: tokenData.stripe_user_id,
        email: details.email,
        displayName: details.displayName,
        country: details.country,
        chargesEnabled: details.chargesEnabled,
        detailsSubmitted: details.detailsSubmitted,
      },
    });

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection.id,
        email: connection.email,
        displayName: connection.displayName,
        country: connection.country,
        chargesEnabled: connection.chargesEnabled,
        detailsSubmitted: connection.detailsSubmitted,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection failed" },
      { status: 500 },
    );
  }
}
