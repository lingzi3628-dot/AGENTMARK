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
  const firebaseUid = body.firebaseUid as string | undefined;
  const history: { role: "user" | "assistant"; content: string }[] = body.history ?? [];

  // Token limit check (if user is authenticated)
  if (firebaseUid) {
    const user = await db.user.findUnique({ where: { firebaseUid } });
    if (user) {
      const today = new Date().toISOString().slice(0, 10);
      if (user.tokenResetDate !== today) {
        await db.user.update({
          where: { id: user.id },
          data: { tokensUsedToday: 0, tokenResetDate: today },
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

  const nodes: WorkflowNode[] = JSON.parse(agent.nodes);
  const edges: WorkflowEdge[] = JSON.parse(agent.edges);

  // Wrap the executor to track tokens after completion
  async function* tracked() {
    let totalTokens = 0;
    for await (const ev of executeAgent(nodes, edges, { input, history })) {
      if (ev.type === "done" && ev.tokens) {
        totalTokens = ev.tokens;
      }
      yield ev;
    }
    // Persist token usage to the user account
    if (firebaseUid && totalTokens > 0) {
      try {
        const user = await db.user.findUnique({ where: { firebaseUid } });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: { tokensUsedToday: { increment: totalTokens } },
          });
          // Also record in UsageRecord
          const today = new Date().toISOString().slice(0, 10);
          await db.usageRecord.upsert({
            where: { userId_date: { userId: user.id, date: today } },
            update: { tokens: { increment: totalTokens }, runs: { increment: 1 } },
            create: { userId: user.id, date: today, tokens: totalTokens, runs: 1 },
          }).catch(() => undefined);
        }
      } catch {
        // non-fatal
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
