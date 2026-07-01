import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/agents/dependencies?uid=<firebaseUid>
// Returns a graph of which agents call which (via sub-agent nodes).
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const agents = await db.agent.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, icon: true, nodes: true, edges: true },
  });

  const nodes = agents.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon || "sparkles",
    isRoot: false,
  }));

  const edges: { source: string; target: string }[] = [];

  for (const agent of agents) {
    try {
      const agentNodes = JSON.parse(agent.nodes || "[]") as Array<{
        id: string;
        data: { kind?: string; subAgentId?: string };
      }>;
      for (const node of agentNodes) {
        if (node.data?.kind === "sub-agent" && node.data?.subAgentId) {
          edges.push({ source: agent.id, target: node.data.subAgentId });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const calledIds = new Set(edges.map((e) => e.target));
  for (const node of nodes) {
    node.isRoot = !calledIds.has(node.id);
  }

  const connectedIds = new Set([
    ...edges.map((e) => e.source),
    ...edges.map((e) => e.target),
  ]);

  return NextResponse.json({
    nodes: nodes.map((n) => ({
      ...n,
      isOrphan: !connectedIds.has(n.id),
    })),
    edges,
    stats: {
      totalAgents: agents.length,
      totalDependencies: edges.length,
      rootAgents: nodes.filter((n) => n.isRoot).length,
      orphanAgents: nodes.filter((n) => !connectedIds.has(n.id)).length,
    },
  });
}
