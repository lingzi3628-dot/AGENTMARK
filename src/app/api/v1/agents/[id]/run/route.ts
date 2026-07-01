import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";
import { checkRateLimit, rateLimitHeaders, RUN_RATE_LIMIT } from "@/lib/rate-limit";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /api/v1/agents/:id/run — run an agent non-streaming.
 *
 * Body: { input: string, history?: HistoryMsg[] }
 * Returns: { runId, output, tokens, durationMs }
 *
 * Rate limited: 20 runs per 60 seconds per API key.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:run")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:run)" }, { status: 403 });
  }

  // Rate limit: 20 runs per 60 seconds per API key
  const rl = checkRateLimit(`run:${user.apiKeyId}`, RUN_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { ...rateLimitHeaders(rl), "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent || agent.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const input = (body.input as string)?.trim() || "Hello";
  const history: HistoryMsg[] = Array.isArray(body.history) ? (body.history as HistoryMsg[]) : [];

  // Daily token-limit guard (same logic as the studio run route).
  const owner = await db.user.findUnique({ where: { id: user.userId } });
  if (owner) {
    const today = new Date().toISOString().slice(0, 10);
    if (owner.tokenResetDate !== today) {
      await db.user.update({
        where: { id: owner.id },
        data: { tokensUsedToday: 0, tokenResetDate: today },
      });
    }
    if (owner.tokensUsedToday >= owner.dailyTokenLimit) {
      return NextResponse.json(
        { error: "Daily token limit reached. Upgrade your plan." },
        { status: 429 },
      );
    }
  }

  const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
  const edges: WorkflowEdge[] = JSON.parse(agent.edges);

  const started = Date.now();
  let output = "";
  let tokens = 0;
  let errored: string | null = null;

  for await (const ev of executeAgent(nodes, edges, { input, history })) {
    if (ev.type === "delta" && ev.content) {
      output += ev.content;
    } else if (ev.type === "done") {
      if (typeof ev.output === "string" && ev.output) output = ev.output;
      if (typeof ev.tokens === "number") tokens = ev.tokens;
    } else if (ev.type === "error") {
      errored = ev.message || "Agent execution failed";
    }
  }
  const durationMs = Date.now() - started;

  // Persist the run (source = "api") and bump daily token accounting.
  try {
    const runRow = await db.runHistory.create({
      data: {
        agentId: agent.id,
        userId: user.userId,
        input,
        output,
        status: errored ? "error" : "completed",
        tokens,
        duration: durationMs,
        source: "api",
      },
    });
    if (owner && tokens > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await db.user.update({
        where: { id: owner.id },
        data: { tokensUsedToday: { increment: tokens } },
      });
      await db.usageRecord
        .upsert({
          where: { userId_date: { userId: owner.id, date: today } },
          update: { tokens: { increment: tokens }, runs: { increment: 1 } },
          create: { userId: owner.id, date: today, tokens, runs: 1 },
        })
        .catch(() => undefined);
    }
    if (errored) {
      return NextResponse.json(
        { runId: runRow.id, output: "", tokens, durationMs, error: errored },
        { status: 500 },
      );
    }
    return NextResponse.json({
      runId: runRow.id,
      output,
      tokens,
      durationMs,
    }, { headers: rateLimitHeaders(rl) });
  } catch {
    // Even if persistence fails, return the result to the caller.
    return NextResponse.json({ runId: "", output, tokens, durationMs }, { headers: rateLimitHeaders(rl) });
  }
}
