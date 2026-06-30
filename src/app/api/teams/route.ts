import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAction } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/**
 * Resolve the firebaseUid from a request — checks both `?firebaseUid=` query
 * and the JSON body (`firebaseUid` field). Throws a structured response if missing.
 */
async function resolveUser(req: NextRequest, body?: Record<string, unknown>) {
  const fromQuery = req.nextUrl.searchParams.get("firebaseUid");
  const uid = fromQuery || (body && typeof body.firebaseUid === "string" ? body.firebaseUid : null);
  if (!uid) return { err: NextResponse.json({ error: "firebaseUid is required" }, { status: 400 }) };
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return { err: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  return { user };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "team";
  let suffix = 1;
  for (;;) {
    const exists = await db.team.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`.slice(0, 40);
  }
}

/** GET /api/teams?firebaseUid=<uid> — list teams the user belongs to. */
export async function GET(req: NextRequest) {
  const { user, err } = await resolveUser(req);
  if (err) return err;
  const memberships = await db.teamMember.findMany({
    where: { userId: user!.id },
    include: { team: { include: { _count: { select: { members: true, agents: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    memberships
      .filter((m) => m.joinedAt) // exclude pending invites
      .map((m) => ({
        id: m.team.id,
        name: m.team.name,
        slug: m.team.slug,
        description: m.team.description,
        plan: m.team.plan,
        ownerId: m.team.ownerId,
        role: m.team.ownerId === user!.id ? "owner" : m.role,
        memberCount: m.team._count.members,
        agentCount: m.team._count.agents,
        createdAt: m.team.createdAt.toISOString(),
        updatedAt: m.team.updatedAt.toISOString(),
      })),
  );
}

/** POST /api/teams {firebaseUid, name, description?} — create a team (creator becomes owner). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { user, err } = await resolveUser(req, body);
  if (err) return err;
  const name = (body.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const description = (body.description as string | undefined)?.trim() || "";

  const base = slugify(name);
  const slug = await uniqueSlug(base);

  const team = await db.team.create({
    data: {
      name,
      slug,
      description,
      ownerId: user!.id,
      plan: "team",
      maxAgents: 100,
      members: {
        create: {
          userId: user!.id,
          role: "owner",
          joinedAt: new Date(),
        },
      },
    },
    include: { _count: { select: { members: true, agents: true } } },
  });

  await logAction({
    teamId: team.id,
    userId: user!.id,
    action: "team.create",
    resourceType: "team",
    resourceId: team.id,
    meta: { name },
    req,
  });

  return NextResponse.json(
    {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      plan: team.plan,
      ownerId: team.ownerId,
      role: "owner",
      memberCount: team._count.members,
      agentCount: team._count.agents,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
