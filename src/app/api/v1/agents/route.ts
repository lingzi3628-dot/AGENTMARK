import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";
import { toAgent } from "@/lib/serialize";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/v1/agents — list the authenticated user's agents (lightweight). */
export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:read")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:read)" }, { status: 403 });
  }
  const rows = await db.agent.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  // Return ISO strings for dates (Prisma returns Date objects when using select).
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  );
}

/** POST /api/v1/agents — create a new agent owned by the API key's user. */
export async function POST(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:write")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:write)" }, { status: 403 });
  }

  // Enforce the user's agent limit (same as the studio POST route).
  const owner = await db.user.findUnique({ where: { id: user.userId } });
  if (owner) {
    const count = await db.agent.count({ where: { userId: user.userId } });
    if (count >= owner.maxAgents) {
      return NextResponse.json(
        { error: `Agent limit reached (${owner.maxAgents}). Delete unused agents or upgrade your plan.` },
        { status: 429 },
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim() || "Untitled Agent";
  const description = (body.description as string)?.trim() || "";
  const icon = (body.icon as string) || "sparkles";
  const category = (body.category as string) || "custom";

  let nodes: WorkflowNode[];
  let edges: WorkflowEdge[];
  if (Array.isArray(body.nodes) && Array.isArray(body.edges)) {
    nodes = body.nodes as WorkflowNode[];
    edges = body.edges as WorkflowEdge[];
  } else {
    nodes = defaultNodes();
    edges = defaultEdges();
  }

  const created = await db.agent.create({
    data: {
      userId: user.userId,
      name,
      description,
      icon,
      category,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
    },
  });
  return NextResponse.json(toAgent(created), { status: 201 });
}

function defaultNodes(): WorkflowNode[] {
  return [
    { id: "trigger-1", type: "agent", position: { x: 80, y: 240 }, data: { label: "Input", kind: "trigger", content: "User message" } },
    { id: "model-1", type: "agent", position: { x: 400, y: 240 }, data: { label: "AI Model", kind: "model", provider: "free-openai", systemPrompt: "You are a helpful AI agent. Respond clearly and concisely." } },
    { id: "output-1", type: "agent", position: { x: 720, y: 240 }, data: { label: "Response", kind: "output" } },
  ];
}

function defaultEdges(): WorkflowEdge[] {
  return [
    { id: "e-trigger-1-model-1", source: "trigger-1", target: "model-1", animated: true },
    { id: "e-model-1-output-1", source: "model-1", target: "output-1", animated: true },
  ];
}
