import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeNextRun, isValidCron, humanizeCron } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

const MAX_SCHEDULES_PER_AGENT = 10;

// List schedules for an agent
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.schedule.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      cron: r.cron,
      timezone: r.timezone,
      input: r.input,
      enabled: r.enabled,
      lastRunAt: r.lastRunAt instanceof Date ? r.lastRunAt.toISOString() : r.lastRunAt,
      lastRunStatus: r.lastRunStatus,
      nextRunAt: r.nextRunAt instanceof Date ? r.nextRunAt.toISOString() : r.nextRunAt,
      humanCron: humanizeCron(r.cron),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  );
}

// Create a schedule for an agent
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify the agent exists
  const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Cap schedules per agent
  const existing = await db.schedule.count({ where: { agentId: id } });
  if (existing >= MAX_SCHEDULES_PER_AGENT) {
    return NextResponse.json(
      { error: `Schedule limit reached (${MAX_SCHEDULES_PER_AGENT} per agent).` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const cron = (body.cron as string)?.trim();
  const timezone = (body.timezone as string)?.trim() || "UTC";
  const input = (body.input as string)?.slice(0, 8000) ?? "";
  const enabled = body.enabled !== false; // default true

  if (!cron) {
    return NextResponse.json({ error: "cron is required" }, { status: 400 });
  }
  if (!isValidCron(cron, timezone)) {
    return NextResponse.json(
      { error: "Invalid cron expression or timezone." },
      { status: 400 },
    );
  }

  const nextRunAt = computeNextRun(cron, timezone);

  const created = await db.schedule.create({
    data: {
      agentId: id,
      cron,
      timezone,
      input,
      enabled,
      nextRunAt: nextRunAt ?? undefined,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      agentId: created.agentId,
      cron: created.cron,
      timezone: created.timezone,
      input: created.input,
      enabled: created.enabled,
      lastRunAt: created.lastRunAt instanceof Date ? created.lastRunAt.toISOString() : created.lastRunAt,
      lastRunStatus: created.lastRunStatus,
      nextRunAt: created.nextRunAt instanceof Date ? created.nextRunAt.toISOString() : created.nextRunAt,
      humanCron: humanizeCron(created.cron),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
