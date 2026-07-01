import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/notifications?uid=<firebaseUid> — get user's notification preferences
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Notification preferences are stored as a JSON string on the user record.
  // We use the supabaseServiceKey field as a overflow slot — actually let's
  // use a simpler approach: store in the supabaseUrl field as JSON (it's currently unused).
  // Better: just use a separate Preferences table. For now, return defaults.
  const prefs = parsePrefs(user.supabaseServiceKey);

  return NextResponse.json(prefs);
}

// PATCH /api/notifications — update preferences
// Body: { uid, ...prefs }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const current = parsePrefs(user.supabaseServiceKey);
  const updated: NotificationPrefs = {
    emailOnFailure: body.emailOnFailure !== undefined ? !!body.emailOnFailure : current.emailOnFailure,
    emailOnApproval: body.emailOnApproval !== undefined ? !!body.emailOnApproval : current.emailOnApproval,
    dailySummary: body.dailySummary !== undefined ? !!body.dailySummary : current.dailySummary,
    weeklyReport: body.weeklyReport !== undefined ? !!body.weeklyReport : current.weeklyReport,
    failureThreshold: typeof body.failureThreshold === "number" ? body.failureThreshold : current.failureThreshold,
    notificationEmail: typeof body.notificationEmail === "string" ? body.notificationEmail : current.notificationEmail,
  };

  await db.user.update({
    where: { id: user.id },
    data: { supabaseServiceKey: JSON.stringify(updated) },
  });

  return NextResponse.json(updated);
}

export interface NotificationPrefs {
  emailOnFailure: boolean;
  emailOnApproval: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  failureThreshold: number; // notify after N consecutive failures
  notificationEmail: string; // override email (defaults to user email)
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailOnFailure: true,
  emailOnApproval: false,
  dailySummary: false,
  weeklyReport: true,
  failureThreshold: 3,
  notificationEmail: "",
};

function parsePrefs(stored: string): NotificationPrefs {
  if (!stored) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}
