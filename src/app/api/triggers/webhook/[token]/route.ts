import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";
import {
  verifyWebhookSignature,
  evaluateFilter,
  renderInputTemplate,
} from "@/lib/webhook";

export const dynamic = "force-dynamic";
// Allow up to 30s for an agent run (also set on the function in vercel.json)
export const maxDuration = 30;

// SYNCHRONOUS_DEADLINE_MS — if the agent hasn't finished by this point, we
// return 202 and let the run continue in the background. Keeps webhook
// callers (Zapier, Make, GitHub, Stripe) within their own timeouts.
const SYNCHRONOUS_DEADLINE_MS = 2800;

interface RunResult {
  status: "success" | "error";
  output: string;
  tokens: number;
  durationMs: number;
}

/**
 * Webhook trigger receiver.
 *
 * URL: POST /api/triggers/webhook/<token>
 *
 * Behaviour:
 *   1. Look up the trigger by token. 404 if not found or disabled.
 *   2. If `secret` is set, verify the HMAC-SHA256 signature in
 *      `X-Webhook-Signature` (constant-time compare).
 *   3. If `filterExpr` is set, evaluate it as JMESPath against the parsed
 *      JSON body. Skip if false.
 *   4. Apply `inputTemplate` to the payload ({{payload}} / {{payload.foo}}).
 *   5. Run the agent. If it finishes within ~2.8s, return 200 with the output.
 *      Otherwise return 202 and let the run continue in the background.
 *   6. Increment `triggerCount`, update `lastTriggeredAt`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const trigger = await db.webhookTrigger.findUnique({
    where: { token },
    include: { agent: true },
  });
  if (!trigger || !trigger.agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!trigger.enabled) {
    return NextResponse.json({ error: "trigger disabled" }, { status: 403 });
  }

  // Read the raw body once — we need it for HMAC verification.
  const rawBody = await req.text();

  // Signature verification (optional — only if secret is set)
  if (trigger.secret) {
    const sig =
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-hub-signature-256") || // GitHub
      req.headers.get("x-zapier-signature") ||
      null;
    if (!verifyWebhookSignature(trigger.secret, rawBody, sig)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  // Parse JSON body. Be permissive about content-type.
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Non-JSON payload — wrap it so templates can still reference it.
      payload = { raw: rawBody.slice(0, 4000) };
    }
  }

  // Filter evaluation (JMESPath)
  if (trigger.filterExpr) {
    const pass = evaluateFilter(trigger.filterExpr, payload);
    if (!pass) {
      // Filter rejected this payload — acknowledge but don't fire.
      return NextResponse.json(
        { ok: true, skipped: true, reason: "filter rejected payload" },
        { status: 200 },
      );
    }
  }

  const agent = trigger.agent;
  const input = renderInputTemplate(trigger.inputTemplate || "{{payload}}", payload);

  // The actual agent run — runs to completion and persists the result to
  // RunHistory + bumps user token usage. We race it against the synchronous
  // deadline so we can return 202 if it takes too long.
  const runPromise = runAgentAndPersist(agent.id, agent.userId, input);

  const deadlinePromise = new Promise<{ timedOut: true }>((resolve) => {
    setTimeout(() => resolve({ timedOut: true }), SYNCHRONOUS_DEADLINE_MS);
  });

  const raced = await Promise.race([runPromise, deadlinePromise]);

  if ("timedOut" in raced) {
    // Let the run finish in the background. Attach a .catch so we don't
    // trigger an unhandled rejection.
    runPromise.catch(() => undefined);
    // Acknowledge the request — the caller can poll RunHistory for the result.
    await db.webhookTrigger
      .update({
        where: { id: trigger.id },
        data: {
          triggerCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      })
      .catch(() => undefined);
    return NextResponse.json(
      { ok: true, message: "Agent running in background" },
      { status: 202 },
    );
  }

  // Synchronous completion
  await db.webhookTrigger
    .update({
      where: { id: trigger.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    })
    .catch(() => undefined);

  if (raced.status === "error") {
    return NextResponse.json(
      { ok: false, error: raced.output },
      { status: 500 },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      output: raced.output.slice(0, 16000),
      tokens: raced.tokens,
      durationMs: raced.durationMs,
    },
    { status: 200 },
  );
}

/**
 * Run the agent to completion, persist the run to RunHistory, and bump the
 * user's token usage if applicable.
 */
async function runAgentAndPersist(
  agentId: string,
  userId: string | null,
  input: string,
): Promise<RunResult> {
  const startedAt = Date.now();
  const agent = await db.agent
    .findUnique({ where: { id: agentId } })
    .catch(() => null);
  if (!agent) {
    return {
      status: "error",
      output: "agent not found",
      tokens: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  let output = "";
  let tokens = 0;
  let status: "success" | "error" = "success";

  try {
    const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
    const edges: WorkflowEdge[] = JSON.parse(agent.edges);
    for await (const ev of executeAgent(nodes, edges, { input, history: [] })) {
      if (ev.type === "done") {
        output = ev.output ?? "";
        tokens = ev.tokens ?? 0;
      } else if (ev.type === "error") {
        status = "error";
        output = ev.message ?? "execution error";
      }
    }
    if (!output) output = "[no output]";
  } catch (err) {
    status = "error";
    output = err instanceof Error ? err.message : "execution failed";
  }

  const durationMs = Date.now() - startedAt;

  // Persist run history with source = "webhook"
  await db.runHistory
    .create({
      data: {
        agentId,
        userId: userId ?? undefined,
        input: input.slice(0, 8000),
        output: output.slice(0, 16000),
        status: status === "success" ? "completed" : "error",
        tokens,
        duration: durationMs,
        source: "webhook",
      },
    })
    .catch(() => undefined);

  // Bump user token usage
  if (userId && tokens > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await db.user
        .update({
          where: { id: userId },
          data: { tokensUsedToday: { increment: tokens } },
        })
        .catch(() => undefined);
      await db.usageRecord
        .upsert({
          where: { userId_date: { userId, date: today } },
          update: { tokens: { increment: tokens }, runs: { increment: 1 } },
          create: { userId, date: today, tokens, runs: 1 },
        })
        .catch(() => undefined);
    } catch {
      // non-fatal
    }
  }

  return { status, output, tokens, durationMs };
}
