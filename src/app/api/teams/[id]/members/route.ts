import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, logAction, TeamAuthError, type TeamRole } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES: TeamRole[] = ["admin", "editor", "viewer"];

interface MemberRow {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: string | null;
  invitedAt: string;
  email: string;
  name: string;
  photoURL: string;
}

function serialize(m: {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date | null;
  invitedAt: Date;
  user: { email: string; name: string; photoURL: string };
}): MemberRow {
  return {
    id: m.id,
    userId: m.userId,
    role: m.role as TeamRole,
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    invitedAt: m.invitedAt.toISOString(),
    email: m.user.email,
    name: m.user.name,
    photoURL: m.user.photoURL,
  };
}

/** GET /api/teams/:id/members?firebaseUid=<uid> — list members (viewer+). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firebaseUid = req.nextUrl.searchParams.get("firebaseUid");
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(user.id, id, "viewer");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const members = await db.teamMember.findMany({
    where: { teamId: id },
    include: { user: { select: { email: true, name: true, photoURL: true } } },
    orderBy: [{ joinedAt: "desc" }, { invitedAt: "desc" }],
  });
  return NextResponse.json(members.map(serialize));
}

/**
 * POST /api/teams/:id/members {firebaseUid, email, role} — invite a user by email.
 *
 * We look up the user by email. If found, we create a TeamMember with
 * joinedAt = null (pending). If not found, we still create the membership so
 * the invite URL will be valid when they sign up — but in that case we don't
 * have a userId, so we just return an error asking the inviter to share the
 * join link manually once the user has signed up.
 *
 * Returns: { memberId, joinUrl } where joinUrl can be copied + shared.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  const role = (body.role as string | undefined) || "viewer";

  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role as TeamRole)) {
    return NextResponse.json({ error: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }, { status: 400 });
  }

  const inviter = await db.user.findUnique({ where: { firebaseUid } });
  if (!inviter) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(inviter.id, id, "admin");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const team = await db.team.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invitee = await db.user.findUnique({ where: { email } });
  if (!invitee) {
    return NextResponse.json(
      {
        error: "That user hasn't signed up yet. Ask them to create an account, then resend the invite.",
        joinUrl: null,
      },
      { status: 404 },
    );
  }

  // Already a member?
  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: invitee.id } },
  });
  if (existing) {
    if (existing.joinedAt) {
      return NextResponse.json(
        { error: "That user is already a member of this team" },
        { status: 409 },
      );
    }
    // Pending invite — return the same join URL.
    return NextResponse.json({
      memberId: existing.id,
      role: existing.role,
      joinUrl: buildJoinUrl(req, team.slug, id, invitee.id),
      pending: true,
    });
  }

  const member = await db.teamMember.create({
    data: {
      teamId: id,
      userId: invitee.id,
      role,
      joinedAt: null,
    },
  });

  await logAction({
    teamId: id,
    userId: inviter.id,
    action: "member.invite",
    resourceType: "user",
    resourceId: invitee.id,
    meta: { email, role },
    req,
  });

  return NextResponse.json(
    {
      memberId: member.id,
      role,
      joinUrl: buildJoinUrl(req, team.slug, id, invitee.id),
      pending: true,
    },
    { status: 201 },
  );
}

function buildJoinUrl(req: NextRequest, slug: string, teamId: string, _userId: string): string {
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  return `${origin}/?joinTeam=${teamId}&slug=${encodeURIComponent(slug)}`;
}
