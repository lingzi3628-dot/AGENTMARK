import { CronExpressionParser } from "cron-parser";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

// ---------------------------------------------------------------------------
// Cron helpers
// ---------------------------------------------------------------------------

/**
 * Validate a cron expression. Returns true if it parses cleanly.
 * cron-parser v5 throws on invalid expressions.
 */
export function isValidCron(expression: string, timezone?: string): boolean {
  try {
    CronExpressionParser.parse(expression, {
      currentDate: new Date(),
      tz: timezone && timezone.length > 0 ? timezone : "UTC",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the next run time for a cron expression in the given timezone.
 * Returns null if the expression is invalid.
 */
export function computeNextRun(cron: string, timezone: string): Date | null {
  try {
    const tz = timezone && timezone.length > 0 ? timezone : "UTC";
    const interval = CronExpressionParser.parse(cron, {
      currentDate: new Date(),
      tz,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Humanise a cron expression for the UI. Covers the common presets we ship;
 * falls back to the raw expression for anything fancy.
 */
export function humanizeCron(expression: string): string {
  const e = expression.trim();
  const map: Record<string, string> = {
    "* * * * *": "Every minute",
    "*/5 * * * *": "Every 5 minutes",
    "*/10 * * * *": "Every 10 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 * * * *": "Every hour",
    "0 */2 * * *": "Every 2 hours",
    "0 */6 * * *": "Every 6 hours",
    "0 */12 * * *": "Every 12 hours",
    "0 0 * * *": "Daily at midnight",
    "0 9 * * *": "Daily at 9am",
    "0 12 * * *": "Daily at noon",
    "0 18 * * *": "Daily at 6pm",
    "0 0 * * 0": "Every Sunday",
    "0 0 * * 1": "Every Monday",
    "0 0 * * 2": "Every Tuesday",
    "0 0 * * 3": "Every Wednesday",
    "0 0 * * 4": "Every Thursday",
    "0 0 * * 5": "Every Friday",
    "0 0 * * 6": "Every Saturday",
    "0 9 * * 1": "Every Monday at 9am",
    "0 9 * * 1-5": "Weekdays at 9am",
    "0 0 1 * *": "First of every month",
  };
  if (map[e]) return map[e];

  // Best-effort: */N minute pattern
  const m1 = e.match(/^\*\/(\d+) \* \* \* \*$/);
  if (m1) return `Every ${m1[1]} minutes`;

  // Best-effort: "M H * * *" → "Daily at HH:MM"
  const m2 = e.match(/^(\d+) (\d+) \* \* \*$/);
  if (m2) {
    const h = Number(m2[1]);
    const min = Number(m2[2]);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      const t = new Date();
      t.setHours(h, min, 0, 0);
      return `Daily at ${t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
  }

  return e;
}

// ---------------------------------------------------------------------------
// Schedule execution
// ---------------------------------------------------------------------------

export interface ScheduleExecutionResult {
  status: "success" | "error";
  tokens: number;
  durationMs: number;
  output: string;
}

/**
 * Run a schedule's agent non-streaming and persist the run to history.
 * Updates lastRunAt / lastRunStatus / nextRunAt on the schedule row.
 */
export async function executeSchedule(
  scheduleId: string,
): Promise<ScheduleExecutionResult> {
  const startedAt = Date.now();
  const schedule = await db.schedule.findUnique({
    where: { id: scheduleId },
    include: { agent: true },
  });

  if (!schedule || !schedule.agent) {
    return {
      status: "error",
      tokens: 0,
      durationMs: Date.now() - startedAt,
      output: "schedule or agent not found",
    };
  }

  const agent = schedule.agent;
  const input = schedule.input || "Hello";

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
    if (!output) {
      output = "[no output]";
    }
  } catch (err) {
    status = "error";
    output = err instanceof Error ? err.message : "execution failed";
  }

  const durationMs = Date.now() - startedAt;

  // Persist to run history with source = "schedule"
  await db.runHistory
    .create({
      data: {
        agentId: agent.id,
        userId: agent.userId ?? undefined,
        input: input.slice(0, 8000),
        output: output.slice(0, 16000),
        status: status === "success" ? "completed" : "error",
        tokens,
        duration: durationMs,
        source: "schedule",
      },
    })
    .catch(() => undefined);

  // Bump the user's token usage if the agent belongs to one
  if (agent.userId && tokens > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await db.user
        .update({
          where: { id: agent.userId },
          data: { tokensUsedToday: { increment: tokens } },
        })
        .catch(() => undefined);
      await db.usageRecord
        .upsert({
          where: { userId_date: { userId: agent.userId, date: today } },
          update: {
            tokens: { increment: tokens },
            runs: { increment: 1 },
          },
          create: {
            userId: agent.userId,
            date: today,
            tokens,
            runs: 1,
          },
        })
        .catch(() => undefined);
    } catch {
      // non-fatal
    }
  }

  // Compute next run and update the schedule row
  const nextRunAt = computeNextRun(schedule.cron, schedule.timezone);

  await db.schedule
    .update({
      where: { id: scheduleId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        nextRunAt: nextRunAt ?? undefined,
      },
    })
    .catch(() => undefined);

  return { status, tokens, durationMs, output };
}

// ---------------------------------------------------------------------------
// Tick — find due schedules and execute them
// ---------------------------------------------------------------------------

/**
 * Find all enabled schedules whose nextRunAt is in the past (or null).
 * Returns the schedule rows.
 */
export async function findDueSchedules() {
  const now = new Date();
  return db.schedule.findMany({
    where: {
      enabled: true,
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
    },
    take: 50, // cap per tick to avoid runaway work
  });
}

/**
 * Find due schedules and execute them all. Returns the count processed.
 * Called by the /api/scheduler/tick endpoint (Vercel Cron + internal ticker).
 */
export async function tick(): Promise<number> {
  const due = await findDueSchedules();
  if (due.length === 0) return 0;

  let processed = 0;
  // Run serially — concurrent agent runs could exhaust the free-tier API.
  for (const s of due) {
    try {
      // Mark as "in-flight" so a re-entrant tick doesn't double-fire it.
      await db.schedule
        .update({
          where: { id: s.id },
          data: { nextRunAt: computeNextRun(s.cron, s.timezone) ?? undefined },
        })
        .catch(() => undefined);
      await executeSchedule(s.id);
      processed += 1;
    } catch (err) {
      console.error("[scheduler] failed schedule", s.id, err);
    }
  }
  return processed;
}
