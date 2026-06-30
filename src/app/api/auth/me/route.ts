import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Get current user by firebaseUid (query param) — lightweight lookup
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  let user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  if (user.tokenResetDate !== today) {
    user = await db.user.update({
      where: { id: user.id },
      data: { tokensUsedToday: 0, tokenResetDate: today },
    });
  }

  return NextResponse.json({
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    name: user.name,
    photoURL: user.photoURL,
    plan: user.plan,
    dailyTokenLimit: user.dailyTokenLimit,
    maxAgents: user.maxAgents,
    tokensUsedToday: user.tokensUsedToday,
    tokenResetDate: user.tokenResetDate,
    // Built-in BYOK keys returned masked (never expose plaintext to the client)
    glmApiKey: maskKey(user.glmApiKey ? decrypt(user.glmApiKey) : ""),
    openaiApiKey: maskKey(user.openaiApiKey ? decrypt(user.openaiApiKey) : ""),
    anthropicApiKey: maskKey(user.anthropicApiKey ? decrypt(user.anthropicApiKey) : ""),
    supabaseUrl: user.supabaseUrl,
    supabaseAnonKey: maskKey(user.supabaseAnonKey ? decrypt(user.supabaseAnonKey) : ""),
    hasGlmKey: !!user.glmApiKey,
    hasOpenaiKey: !!user.openaiApiKey,
    hasAnthropicKey: !!user.anthropicApiKey,
    stripeCustomerId: user.stripeCustomerId,
    stripePriceId: user.stripePriceId,
  });
}

// Update user settings (API keys, Supabase config, plan)
// Keys are encrypted at rest with AES-256-GCM before being written to DB.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  if (!uid) return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  // Built-in BYOK keys — encrypt on save. An empty string clears the key.
  if (body.glmApiKey !== undefined) {
    data.glmApiKey = body.glmApiKey ? encrypt(body.glmApiKey) : "";
  }
  if (body.openaiApiKey !== undefined) {
    data.openaiApiKey = body.openaiApiKey ? encrypt(body.openaiApiKey) : "";
  }
  if (body.anthropicApiKey !== undefined) {
    data.anthropicApiKey = body.anthropicApiKey ? encrypt(body.anthropicApiKey) : "";
  }
  if (body.supabaseUrl !== undefined) data.supabaseUrl = body.supabaseUrl;
  if (body.supabaseAnonKey !== undefined) {
    data.supabaseAnonKey = body.supabaseAnonKey ? encrypt(body.supabaseAnonKey) : "";
  }
  if (body.supabaseServiceKey !== undefined) {
    data.supabaseServiceKey = body.supabaseServiceKey ? encrypt(body.supabaseServiceKey) : "";
  }
  if (body.plan) data.plan = body.plan;
  if (body.dailyTokenLimit !== undefined) data.dailyTokenLimit = body.dailyTokenLimit;
  if (body.maxAgents !== undefined) data.maxAgents = body.maxAgents;
  if (body.stripeCustomerId !== undefined) data.stripeCustomerId = body.stripeCustomerId;
  if (body.stripeSubscriptionId !== undefined) data.stripeSubscriptionId = body.stripeSubscriptionId;
  if (body.stripePriceId !== undefined) data.stripePriceId = body.stripePriceId;

  const updated = await db.user.update({ where: { id: user.id }, data });

  return NextResponse.json({
    id: updated.id,
    plan: updated.plan,
    dailyTokenLimit: updated.dailyTokenLimit,
    maxAgents: updated.maxAgents,
    glmApiKey: maskKey(updated.glmApiKey ? decrypt(updated.glmApiKey) : ""),
    openaiApiKey: maskKey(updated.openaiApiKey ? decrypt(updated.openaiApiKey) : ""),
    anthropicApiKey: maskKey(updated.anthropicApiKey ? decrypt(updated.anthropicApiKey) : ""),
    supabaseUrl: updated.supabaseUrl,
    supabaseAnonKey: maskKey(updated.supabaseAnonKey ? decrypt(updated.supabaseAnonKey) : ""),
    hasGlmKey: !!updated.glmApiKey,
    hasOpenaiKey: !!updated.openaiApiKey,
    hasAnthropicKey: !!updated.anthropicApiKey,
    stripeCustomerId: updated.stripeCustomerId,
    stripePriceId: updated.stripePriceId,
  });
}
