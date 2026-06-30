import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeAgent, toSSEResponse } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pub = await db.publishedAgent.findUnique({ where: { slug } });
  if (!pub || !pub.enabled) {
    return new Response(JSON.stringify({ error: "Agent not published" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  const agent = await db.agent.findUnique({ where: { id: pub.agentId } });
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent missing" }), {
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
      "access-control-allow-origin": "*",
      connection: "keep-alive",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
