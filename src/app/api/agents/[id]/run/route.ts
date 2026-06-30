import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeAgent, toSSEResponse } from "@/lib/ai";
import { calculateCost } from "@/lib/pricing";
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
  const firebaseUid = body.firebaseUid as string | undefined;
  const history: { role: "user" | "assistant"; content: string }[] = body.history ?? [];
  // Source of the run — manual (Run button), schedule, webhook, api, integration.
  // Defaults to "manual" for direct studio runs.
  const source = (body.source as string | undefined)?.trim() || "manual";

  const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
  const edges: WorkflowEdge[] = JSON.parse(agent.edges);

  // Token + spend limit check (if user is authenticated)
  if (firebaseUid) {
    const user = await db.user.findUnique({ where: { firebaseUid } });
    if (user) {
      const today = new Date().toISOString().slice(0, 10);
      // Reset both token + spend counters on a new day
      if (user.tokenResetDate !== today) {
        await db.user.update({
          where: { id: user.id },
          data: {
            tokensUsedToday: 0,
            tokenResetDate: today,
            spendUsedTodayCents: 0,
            spendResetDate: today,
          },
        });
      }
      if (user.tokensUsedToday >= user.dailyTokenLimit) {
        return new Response(
          JSON.stringify({ error: "Daily token limit reached. Upgrade your plan in Settings." }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
    }
  }

  // Wrap the executor to track tokens + cost after completion.
  // The done event from executeAgent() now includes inputTokens,
  // outputTokens, and provider — we use them to calculate USD cost.
  async function* tracked() {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let provider = "free-openai";

    for await (const ev of executeAgent(nodes, edges, { input, history, agentId: id })) {
      if (ev.type === "done") {
        totalTokens = ev.tokens ?? 0;
        inputTokens = ev.inputTokens ?? 0;
        outputTokens = ev.outputTokens ?? 0;
        provider = ev.provider ?? "free-openai";
      }
      yield ev;
    }

    // Calculate cost in USD cents. Free-* models always cost $0.
    const costCents = calculateCost(provider, inputTokens, outputTokens);

    // Emit a "cost" event so the client can display + persist the cost
    // alongside the run record (RunHistory row is created client-side via
    // POST /api/agents/[id]/runs after the SSE stream completes).
    if (costCents > 0 || inputTokens > 0 || outputTokens > 0) {
      yield {
        type: "trace" as const,
        node: "billing",
        label: `Cost: $${(costCents / 100).toFixed(4)} (${provider}, in=${inputTokens} out=${outputTokens})`,
        status: "streaming",
      };
    }
    yield {
      type: "trace" as const,
      node: "__cost__",
      label: "cost",
      status: "done",
      // Re-use the trace event payload — the client reads costCents + source
      // from this special __cost__ node marker. The RunHistory POST endpoint
      // accepts these fields and stores them on the row.
      content: JSON.stringify({ costCents, source, inputTokens, outputTokens, provider }),
    };

    // Persist token usage + cost to the user account + aggregate tables.
    if (firebaseUid && totalTokens > 0) {
      try {
        const user = await db.user.findUnique({ where: { firebaseUid } });
        if (user) {
          const today = new Date().toISOString().slice(0, 10);
          // Update tokens + spend. spendUsedTodayCents was reset above if it's
          // a new day — but we re-check defensively in case the run crossed
          // midnight.
          const spendResetNeeded = user.spendResetDate !== today;
          await db.user.update({
            where: { id: user.id },
            data: {
              tokensUsedToday: { increment: totalTokens },
              spendUsedTodayCents: spendResetNeeded
                ? costCents
                : { increment: costCents },
              spendResetDate: spendResetNeeded ? today : undefined,
            },
          });

          // UsageRecord: per-user daily rollup with cost
          await db.usageRecord.upsert({
            where: { userId_date: { userId: user.id, date: today } },
            update: {
              tokens: { increment: totalTokens },
              runs: { increment: 1 },
              costCents: { increment: costCents },
            },
            create: {
              userId: user.id,
              date: today,
              tokens: totalTokens,
              runs: 1,
              costCents,
            },
          }).catch(() => undefined);

          // CostRecord: per-agent daily rollup (used by analytics + dashboards)
          await db.costRecord.upsert({
            where: { agentId_date: { agentId: id, date: today } },
            update: {
              tokens: { increment: totalTokens },
              runs: { increment: 1 },
              costCents: { increment: costCents },
            },
            create: {
              agentId: id,
              userId: user.id,
              date: today,
              tokens: totalTokens,
              runs: 1,
              costCents,
            },
          }).catch(() => undefined);
        }
      } catch {
        // non-fatal — the run already succeeded
      }
    }
  }

  const stream = toSSEResponse(tracked());

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
