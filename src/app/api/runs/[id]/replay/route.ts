import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/runs/[id]/replay — re-run a past run with the same input.
// Returns the new output + a diff against the original output.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const originalRun = await db.runHistory.findUnique({ where: { id } });
  if (!originalRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const agent = await db.agent.findUnique({ where: { id: originalRun.agentId } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const nodes = JSON.parse(agent.nodes || "[]") as WorkflowNode[];
  const edges = JSON.parse(agent.edges || "[]") as WorkflowEdge[];

  // Re-run with the original input
  const events: { type: string; output?: string; tokens?: number; message?: string }[] = [];
  try {
    for await (const event of executeAgent(nodes, edges, {
      input: originalRun.input,
      history: [],
      agentId: agent.id,
    })) {
      events.push(event);
    }
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "replay failed",
      originalOutput: originalRun.output,
    }, { status: 500 });
  }

  const doneEvent = events.find((e) => e.type === "done") as { output?: string; tokens?: number } | undefined;
  const newOutput = doneEvent?.output || "";
  const newTokens = doneEvent?.tokens || 0;
  const errorEvent = events.find((e) => e.type === "error") as { message?: string } | undefined;

  // Compute simple diff
  const diff = computeDiff(originalRun.output, newOutput);

  // Save the replay as a new run history entry
  const replayRun = await db.runHistory.create({
    data: {
      agentId: agent.id,
      userId: originalRun.userId,
      input: originalRun.input,
      output: newOutput,
      status: errorEvent ? "error" : "completed",
      tokens: newTokens,
      duration: 0,
      source: "replay",
    },
  });

  return NextResponse.json({
    ok: !errorEvent,
    replayRunId: replayRun.id,
    originalRun: {
      id: originalRun.id,
      output: originalRun.output,
      tokens: originalRun.tokens,
      status: originalRun.status,
      createdAt: originalRun.createdAt.toISOString(),
    },
    newRun: {
      id: replayRun.id,
      output: newOutput,
      tokens: newTokens,
      status: replayRun.status,
      createdAt: replayRun.createdAt.toISOString(),
    },
    diff,
    tokensDelta: newTokens - originalRun.tokens,
    identical: originalRun.output.trim() === newOutput.trim(),
  });
}

/** Simple line-based diff — returns added/removed/unchanged lines. */
function computeDiff(original: string, updated: string): {
  added: string[];
  removed: string[];
  unchanged: number;
  similarity: number;
} {
  const origLines = original.split("\n");
  const newLines = updated.split("\n");
  const origSet = new Set(origLines);
  const newSet = new Set(newLines);

  const added = newLines.filter((l) => !origSet.has(l));
  const removed = origLines.filter((l) => !newSet.has(l));
  const unchanged = origLines.filter((l) => newSet.has(l)).length;

  const maxLen = Math.max(origLines.length, newLines.length, 1);
  const similarity = Math.round((unchanged / maxLen) * 100);

  return { added, removed, unchanged, similarity };
}
