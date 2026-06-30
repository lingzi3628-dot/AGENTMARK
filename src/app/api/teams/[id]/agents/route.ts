import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, logAction, TeamAuthError } from "@/lib/team-auth";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/teams/:id/agents?firebaseUid=<uid> — list team agents (viewer+). */
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

  const rows = await db.agent.findMany({
    where: { teamId: id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(rows.map(toAgent));
}

/** POST /api/teams/:id/agents {firebaseUid, name, description?, icon?, category?} — create agent in team (editor+). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(user.id, id, "editor");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const team = await db.team.findUnique({ where: { id }, select: { maxAgents: true } });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await db.agent.count({ where: { teamId: id } });
  if (count >= team.maxAgents) {
    return NextResponse.json(
      { error: `Team agent limit reached (${team.maxAgents}).` },
      { status: 429 },
    );
  }

  const name = (body.name as string)?.trim() || "Untitled Team Agent";
  const description = (body.description as string)?.trim() || "";
  const icon = (body.icon as string) || "sparkles";
  const category = (body.category as string) || "team";

  const created = await db.agent.create({
    data: {
      teamId: id,
      name,
      description,
      icon,
      category,
      nodes: JSON.stringify(defaultNodes()),
      edges: JSON.stringify(defaultEdges()),
    },
  });

  await logAction({
    teamId: id,
    userId: user.id,
    action: "agent.create",
    resourceType: "agent",
    resourceId: created.id,
    meta: { name },
    req,
  });

  return NextResponse.json(toAgent(created), { status: 201 });
}

function defaultNodes() {
  return [
    { id: "trigger-1", type: "agent", position: { x: 80, y: 240 }, data: { label: "Input", kind: "trigger", content: "User message" } },
    { id: "model-1", type: "agent", position: { x: 400, y: 240 }, data: { label: "AI Model", kind: "model", provider: "free-openai", systemPrompt: "You are a helpful AI agent." } },
    { id: "output-1", type: "agent", position: { x: 720, y: 240 }, data: { label: "Response", kind: "output" } },
  ];
}

function defaultEdges() {
  return [
    { id: "e-trigger-1-model-1", source: "trigger-1", target: "model-1", animated: true },
    { id: "e-model-1-output-1", source: "model-1", target: "output-1", animated: true },
  ];
}
