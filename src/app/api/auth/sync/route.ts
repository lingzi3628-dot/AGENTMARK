import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Sync a Firebase user into the DB. Called after Google sign-in.
// Body: { uid, email, name, photoURL }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  const email = body.email as string;
  if (!uid || !email) {
    return NextResponse.json({ error: "uid and email required" }, { status: 400 });
  }

  const name = body.name || email.split("@")[0];
  const photoURL = body.photoURL || "";
  const today = new Date().toISOString().slice(0, 10);

  // Find or create user
  let user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    user = await db.user.create({
      data: {
        firebaseUid: uid,
        email,
        name,
        photoURL,
        tokenResetDate: today,
      },
    });
  } else {
    // Update name/photo if changed
    user = await db.user.update({
      where: { id: user.id },
      data: { email, name, photoURL },
    });
  }

  // Reset daily tokens if it's a new day
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
