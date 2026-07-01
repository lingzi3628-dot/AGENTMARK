import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OAUTH_PROVIDERS, getOAuthProvider, isOAuthProviderConfigured, buildAuthUrl } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

// GET /api/connectors — list user's connected OAuth tokens + available providers
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const tokens = await db.oAuthToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    connected: tokens.map((t) => ({
      id: t.id,
      provider: t.provider,
      providerEmail: t.providerEmail,
      providerUserName: t.providerUserName,
      providerAvatar: t.providerAvatar,
      scopes: t.scopes,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt?.toISOString() || null,
    })),
    available: OAUTH_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      description: p.description,
      configured: isOAuthProviderConfigured(p),
      envVar: p.clientIdEnv,
    })),
  });
}

// POST /api/connectors — start OAuth flow for a provider
// Body: { provider: "google" | "github" | ..., uid }
// Returns: { authUrl } — client redirects the browser there
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const providerId = body.provider as string;
  const uid = body.uid as string;

  if (!providerId || !uid) {
    return NextResponse.json({ error: "provider and uid required" }, { status: 400 });
  }

  const provider = getOAuthProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  if (!isOAuthProviderConfigured(provider)) {
    return NextResponse.json(
      { error: `Provider not configured. Set ${provider.clientIdEnv} and ${provider.clientSecretEnv} env vars.` },
      { status: 503 },
    );
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const redirectUri = `${proto}://${host}/api/connectors/oauth/callback`;

  const state = `${uid}:${providerId}:${Math.random().toString(36).slice(2, 10)}`;
  const authUrl = buildAuthUrl(provider, redirectUri, state);
  return NextResponse.json({ authUrl, state });
}
