import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    glmApiKey: user.glmApiKey,
    openaiApiKey: user.openaiApiKey,
    anthropicApiKey: user.anthropicApiKey,
    supabaseUrl: user.supabaseUrl,
    supabaseAnonKey: user.supabaseAnonKey,
  });
}

// Update user settings (API keys, Supabase config, plan)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  if (!uid) return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      glmApiKey: body.glmApiKey ?? user.glmApiKey,
      openaiApiKey: body.openaiApiKey ?? user.openaiApiKey,
      anthropicApiKey: body.anthropicApiKey ?? user.anthropicApiKey,
      supabaseUrl: body.supabaseUrl ?? user.supabaseUrl,
      supabaseAnonKey: body.supabaseAnonKey ?? user.supabaseAnonKey,
      supabaseServiceKey: body.supabaseServiceKey ?? user.supabaseServiceKey,
      plan: body.plan ?? user.plan,
      dailyTokenLimit: body.dailyTokenLimit ?? user.dailyTokenLimit,
      maxAgents: body.maxAgents ?? user.maxAgents,
    },
  });

  return NextResponse.json({
    id: updated.id,
    plan: updated.plan,
    dailyTokenLimit: updated.dailyTokenLimit,
    maxAgents: updated.maxAgents,
    glmApiKey: maskKey(updated.glmApiKey),
    openaiApiKey: maskKey(updated.openaiApiKey),
    anthropicApiKey: maskKey(updated.anthropicApiKey),
    supabaseUrl: updated.supabaseUrl,
    supabaseAnonKey: maskKey(updated.supabaseAnonKey),
  });
}

function maskKey(k: string): string {
  if (!k || k.length < 8) return k ? "••••" : "";
  return k.slice(0, 4) + "••••" + k.slice(-4);
}
