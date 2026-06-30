import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/teams/join {firebaseUid, teamId}
 *
 * Accept a pending invitation. Looks up the caller's TeamMember row for the
 * given team and stamps `joinedAt = now`. If they were never invited (or have
 * already joined), returns an appropriate error.
 *
 * This route is also auto-called by the studio when a user lands on `/?joinTeam=...`.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  const teamId = body.teamId as string | undefined;
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, ownerId: true } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Owner auto-joined at creation — no-op.
  if (team.ownerId === user.id) {
    return NextResponse.json({ ok: true, already: true, teamId });
  }

  const member = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });
  if (!member) {
    return NextResponse.json({ error: "You don't have a pending invite to this team" }, { status: 404 });
  }
  if (member.joinedAt) {
    return NextResponse.json({ ok: true, already: true, teamId });
  }

  const updated = await db.teamMember.update({
    where: { id: member.id },
    data: { joinedAt: new Date() },
  });

  await logAction({
    teamId,
    userId: user.id,
    action: "member.join",
    resourceType: "user",
    resourceId: user.id,
    meta: { role: updated.role },
    req,
  });

  return NextResponse.json({ ok: true, teamId, role: updated.role });
}
