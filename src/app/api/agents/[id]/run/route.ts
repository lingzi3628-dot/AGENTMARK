import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeAgent, toSSEResponse } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const input = (body.input as string)?.trim() || "Hello";
  const history: { role: "user" | "assistant"; content: string }[] = body.history ?? [];

  const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
  const edges: WorkflowEdge[] = JSON.parse(agent.edges);

  const events = executeAgent(nodes, edges, { input, history });
  const stream = toSSEResponse(events);

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
