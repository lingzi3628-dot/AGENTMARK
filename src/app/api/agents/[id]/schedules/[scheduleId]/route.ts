import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeNextRun, isValidCron, humanizeCron, executeSchedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// PATCH — update cron / timezone / input / enabled. Recomputes nextRunAt when
// cron or timezone changes.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const { scheduleId } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.schedule.findUnique({ where: { id: scheduleId } });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const cron = body.cron !== undefined ? (body.cron as string).trim() : existing.cron;
  const timezone =
    body.timezone !== undefined ? (body.timezone as string).trim() || "UTC" : existing.timezone;
  const input =
    body.input !== undefined ? (body.input as string).slice(0, 8000) : existing.input;
  const enabled = body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled;

  if (body.cron !== undefined || body.timezone !== undefined) {
    if (!isValidCron(cron, timezone)) {
      return NextResponse.json(
        { error: "Invalid cron expression or timezone." },
        { status: 400 },
      );
    }
  }

  // If cron/timezone changed, recompute nextRunAt. If the schedule was just
  // re-enabled, also recompute. Otherwise preserve the existing nextRunAt.
  let nextRunAt: Date | null | undefined = undefined; // undefined = leave as-is
  if (body.cron !== undefined || body.timezone !== undefined) {
    nextRunAt = computeNextRun(cron, timezone);
  } else if (body.enabled === true && !existing.enabled) {
    nextRunAt = computeNextRun(cron, timezone);
  } else if (body.enabled === false) {
    nextRunAt = null; // disabled — no next run
  }

  const updated = await db.schedule.update({
    where: { id: scheduleId },
    data: {
      cron,
      timezone,
      input,
      enabled,
      ...(nextRunAt !== undefined ? { nextRunAt } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    agentId: updated.agentId,
    cron: updated.cron,
    timezone: updated.timezone,
    input: updated.input,
    enabled: updated.enabled,
    lastRunAt: updated.lastRunAt instanceof Date ? updated.lastRunAt.toISOString() : updated.lastRunAt,
    lastRunStatus: updated.lastRunStatus,
    nextRunAt: updated.nextRunAt instanceof Date ? updated.nextRunAt.toISOString() : updated.nextRunAt,
    humanCron: humanizeCron(updated.cron),
    createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
  });
}

// DELETE — remove a schedule
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const { scheduleId } = await params;
  await db.schedule.delete({ where: { id: scheduleId } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

// POST — "Run now": fire the schedule immediately out-of-band.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; scheduleId: string }> }) {
  const { scheduleId } = await params;
  const existing = await db.schedule.findUnique({ where: { id: scheduleId } });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  // Respect the sync/async preference. Default: run synchronously and return
  // the output so the UI can show a toast with the result. If the caller
  // asks for async (`?async=1`), we fire-and-forget.
  const asyncMode = req.nextUrl.searchParams.get("async") === "1";
  if (asyncMode) {
    void executeSchedule(scheduleId).catch(() => undefined);
    return NextResponse.json({ ok: true, message: "running in background" });
  }

  try {
    const result = await executeSchedule(scheduleId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: "error" as const,
        tokens: 0,
        durationMs: 0,
        output: err instanceof Error ? err.message : "execution failed",
      },
      { status: 500 },
    );
  }
}
