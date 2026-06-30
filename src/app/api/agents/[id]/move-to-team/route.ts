import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, logAction, TeamAuthError } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/:id/move-to-team {firebaseUid, teamId?}
 *
 * Move a personal agent into a team (or back out of a team by passing
 * teamId = null). Caller must OWN the agent (be its userId) AND have at least
 * the `editor` role on the target team.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  const teamId = body.teamId === null ? null : (body.teamId as string | undefined);

  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Caller must own the agent (personal agents have userId === caller.id).
  // For agents already in a team, the caller must be at least editor on that team.
  if (agent.userId && agent.userId !== user.id) {
    if (!agent.teamId) {
      return NextResponse.json({ error: "You don't own this agent" }, { status: 403 });
    }
    try {
      await requireTeamRole(user.id, agent.teamId, "editor");
    } catch (e) {
      if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }

  // Target team check
  if (teamId) {
    try {
      await requireTeamRole(user.id, teamId, "editor");
    } catch (e) {
      if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    // Enforce target team's maxAgents
    const team = await db.team.findUnique({ where: { id: teamId }, select: { maxAgents: true, name: true } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    const count = await db.agent.count({ where: { teamId } });
    if (count >= team.maxAgents) {
      return NextResponse.json(
        { error: `Team agent limit reached (${team.maxAgents})` },
        { status: 429 },
      );
    }
  }

  const updated = await db.agent.update({
    where: { id },
    data: {
      teamId: teamId ?? null,
      // When moving into a team, clear the per-user ownership so the team owns it.
      userId: teamId ? null : user.id,
    },
  });

  await logAction({
    teamId: teamId ?? agent.teamId,
    userId: user.id,
    action: "agent.move",
    resourceType: "agent",
    resourceId: id,
    meta: { fromTeamId: agent.teamId, toTeamId: teamId },
    req,
  });

  return NextResponse.json({
    ok: true,
    agentId: id,
    teamId: updated.teamId,
    userId: updated.userId,
  });
}
