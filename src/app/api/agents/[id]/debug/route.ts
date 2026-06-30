import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent, type ExecEvent } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

// Run a workflow with sample input and return per-node outputs.
// Body: { sampleInput: string, nodeId?: string }
// If nodeId is provided, only runs up to that node (partial debug).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const sampleInput = (body.sampleInput as string)?.trim() || "Test input";
  const stopAtNodeId = (body.nodeId as string)?.trim() || undefined;

  const nodes = JSON.parse(agent.nodes || "[]") as WorkflowNode[];
  const edges = JSON.parse(agent.edges || "[]") as WorkflowEdge[];

  // If stopAtNodeId is set, truncate the graph to only include nodes up to that one
  let runNodes = nodes;
  let runEdges = edges;
  if (stopAtNodeId) {
    const upstream = new Set<string>();
    const queue = [stopAtNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      upstream.add(current);
      for (const edge of edges) {
        if (edge.target === current && !upstream.has(edge.source)) {
          queue.push(edge.source);
        }
      }
    }
    runNodes = nodes.filter((n) => upstream.has(n.id));
    runEdges = edges.filter((e) => upstream.has(e.source) && upstream.has(e.target));
  }

  const startedAt = Date.now();
  const nodeOutputs: Record<string, { nodeId: string; label: string; kind: string; output: string; status: string; durationMs: number; tokens?: number; error?: string }> = {};

  try {
    const events: ExecEvent[] = [];
    const generator = executeAgent(runNodes, runEdges, {
      input: sampleInput,
      history: [],
    });

    for await (const event of generator) {
      events.push(event);
    }

    // Reconstruct per-node outputs from the event stream
    for (const node of runNodes) {
      const traceEvents = events.filter((e) => e.node === node.id);
      const doneEvent = traceEvents.find((e) => e.type === "done");
      const errorEvent = traceEvents.find((e) => e.type === "error");

      nodeOutputs[node.id] = {
        nodeId: node.id,
        label: node.data?.label || node.id,
        kind: node.data?.kind || "unknown",
        output: doneEvent?.output || "",
        status: errorEvent ? "error" : doneEvent ? "done" : traceEvents.length > 0 ? "running" : "skipped",
        durationMs: 0,
        tokens: doneEvent?.tokens,
        error: errorEvent?.message,
      };
    }

    const finalOutput = events.find((e) => e.type === "done")?.output || "";
    const totalTokens = events.find((e) => e.type === "done")?.tokens || 0;
    const durationMs = Date.now() - startedAt;
    const errorEvent = events.find((e) => e.type === "error");

    return NextResponse.json({
      ok: !errorEvent,
      sampleInput,
      finalOutput,
      totalTokens,
      durationMs,
      nodeCount: runNodes.length,
      edgeCount: runEdges.length,
      nodeOutputs: Object.values(nodeOutputs),
      error: errorEvent?.message,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "debug run failed";
    return NextResponse.json({
      ok: false,
      error: msg,
      sampleInput,
      durationMs: Date.now() - startedAt,
      nodeOutputs: Object.values(nodeOutputs),
    }, { status: 500 });
  }
}
