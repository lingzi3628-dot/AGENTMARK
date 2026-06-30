import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, logAction, TeamAuthError, type TeamRole } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: TeamRole[] = ["admin", "editor", "viewer"];

/** PATCH /api/teams/:id/members/:memberId {firebaseUid, role} — admin+ only. Can't demote owner. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  const newRole = body.role as string | undefined;
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  if (!newRole || !ALLOWED_ROLES.includes(newRole as TeamRole)) {
    return NextResponse.json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }, { status: 400 });
  }

  const actor = await db.user.findUnique({ where: { firebaseUid } });
  if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(actor.id, id, "admin");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const team = await db.team.findUnique({ where: { id }, select: { ownerId: true } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const target = await db.teamMember.findUnique({ where: { id: memberId } });
  if (!target || target.teamId !== id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Can't change the owner's role.
  if (team.ownerId === target.userId) {
    return NextResponse.json({ error: "Can't change the team owner's role" }, { status: 400 });
  }
  // Can't promote anyone to owner via this route (ownership transfer is a separate action).
  if (newRole === "owner") {
    return NextResponse.json({ error: "Ownership transfer is not supported here" }, { status: 400 });
  }

  const updated = await db.teamMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  await logAction({
    teamId: id,
    userId: actor.id,
    action: "member.role_change",
    resourceType: "user",
    resourceId: target.userId,
    meta: { from: target.role, to: newRole },
    req,
  });

  return NextResponse.json({
    id: updated.id,
    userId: updated.userId,
    role: updated.role,
  });
}

/**
 * DELETE /api/teams/:id/members/:memberId?firebaseUid=<uid>
 * Removes a member. Admin+ can remove anyone (except the owner). A member can
 * always remove themselves (i.e. leave the team).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  const firebaseUid = req.nextUrl.searchParams.get("firebaseUid");
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  const actor = await db.user.findUnique({ where: { firebaseUid } });
  if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const target = await db.teamMember.findUnique({ where: { id: memberId } });
  if (!target || target.teamId !== id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const team = await db.team.findUnique({ where: { id }, select: { ownerId: true } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSelf = target.userId === actor.id;
  // Owner can't be removed (they must transfer ownership first — not supported here).
  if (team.ownerId === target.userId) {
    return NextResponse.json({ error: "Can't remove the team owner" }, { status: 400 });
  }
  if (!isSelf) {
    try {
      await requireTeamRole(actor.id, id, "admin");
    } catch (e) {
      if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  await db.teamMember.delete({ where: { id: memberId } });

  await logAction({
    teamId: id,
    userId: actor.id,
    action: isSelf ? "member.leave" : "member.remove",
    resourceType: "user",
    resourceId: target.userId,
    meta: { role: target.role },
    req,
  });

  return NextResponse.json({ ok: true });
}
