import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { getOAuthProvider, exchangeCodeForToken, fetchUserInfo } from "@/lib/oauth-providers";

export const dynamic = "force-dynamic";

// GET /api/connectors/oauth/callback?code=...&state=uid:provider:random
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") || "";
  const error = req.nextUrl.searchParams.get("error");
  const origin = req.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${origin}/connectors?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/connectors?error=missing_params`);
  }

  const [uid, providerId] = state.split(":");
  if (!uid || !providerId) {
    return NextResponse.redirect(`${origin}/connectors?error=invalid_state`);
  }

  const provider = getOAuthProvider(providerId);
  if (!provider) {
    return NextResponse.redirect(`${origin}/connectors?error=unknown_provider`);
  }

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    return NextResponse.redirect(`${origin}/connectors?error=user_not_found`);
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const redirectUri = `${proto}://${host}/api/connectors/oauth/callback`;

  const tokenData = await exchangeCodeForToken(provider, code, redirectUri);
  if (!tokenData.access_token) {
    const errMsg = tokenData.error || "token_exchange_failed";
    return NextResponse.redirect(`${origin}/connectors?error=${encodeURIComponent(errMsg)}`);
  }

  const userInfo = await fetchUserInfo(provider, tokenData.access_token);

  const encryptedAccessToken = encrypt(tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : "";
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await db.oAuthToken.upsert({
    where: { userId_provider: { userId: user.id, provider: providerId } },
    create: {
      userId: user.id,
      provider: providerId,
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      scopes: tokenData.scope || provider.scopes.join(" "),
      providerUserId: userInfo.id || "",
      providerEmail: userInfo.email || "",
      providerUserName: userInfo.name || "",
      providerAvatar: userInfo.avatar || "",
      isActive: true,
    },
    update: {
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      scopes: tokenData.scope || provider.scopes.join(" "),
      providerUserId: userInfo.id || "",
      providerEmail: userInfo.email || "",
      providerUserName: userInfo.name || "",
      providerAvatar: userInfo.avatar || "",
      isActive: true,
    },
  });

  return NextResponse.redirect(`${origin}/connectors?success=${providerId}`);
}

// Server-side helper: get a decrypted OAuth token for a user + provider
export async function getOAuthToken(userId: string, providerId: string): Promise<string | null> {
  const token = await db.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: providerId } },
  });
  if (!token || !token.isActive) return null;
  return decrypt(token.encryptedAccessToken);
}
