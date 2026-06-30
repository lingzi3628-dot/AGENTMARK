import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, logAction, TeamAuthError, type TeamRole } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

async function getFirebaseUid(req: NextRequest, body?: Record<string, unknown>): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get("firebaseUid");
  if (fromQuery) return fromQuery;
  if (body && typeof body.firebaseUid === "string") return body.firebaseUid;
  return null;
}

async function getUser(firebaseUid: string | null) {
  if (!firebaseUid) return null;
  return db.user.findUnique({ where: { firebaseUid }, select: { id: true, name: true, email: true, photoURL: true } });
}

/** GET /api/teams/:id?firebaseUid=<uid> — team details + counts. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await getFirebaseUid(req);
  const user = await getUser(uid);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(user.id, id, "viewer");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const team = await db.team.findUnique({
    where: { id },
    include: { _count: { select: { members: true, agents: true } } },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: user.id } },
    select: { role: true, joinedAt: true },
  });
  const role: TeamRole = team.ownerId === user.id ? "owner" : (membership?.role as TeamRole) ?? "viewer";

  return NextResponse.json({
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
    plan: team.plan,
    maxAgents: team.maxAgents,
    ownerId: team.ownerId,
    role,
    memberCount: team._count.members,
    agentCount: team._count.agents,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  });
}

/** PATCH /api/teams/:id {firebaseUid, name?, description?} — admin+ only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const uid = await getFirebaseUid(req, body);
  const user = await getUser(uid);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(user.id, id, "admin");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const team = await db.team.findUnique({ where: { id } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { name?: string; description?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await db.team.update({ where: { id }, data });
  await logAction({
    teamId: id,
    userId: user.id,
    action: "team.update",
    resourceType: "team",
    resourceId: id,
    meta: data,
    req,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description,
    plan: updated.plan,
    ownerId: updated.ownerId,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

/** DELETE /api/teams/:id?firebaseUid=<uid> — owner only (cascades). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await getFirebaseUid(req);
  const user = await getUser(uid);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const team = await db.team.findUnique({ where: { id }, select: { ownerId: true, name: true } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the team owner can delete it" }, { status: 403 });
  }

  await logAction({
    teamId: id,
    userId: user.id,
    action: "team.delete",
    resourceType: "team",
    resourceId: id,
    meta: { name: team.name },
    req,
  });

  await db.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
