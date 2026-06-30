import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Totals {
  runs: number;
  tokens: number;
  avgDurationMs: number;
  successRate: number;
}
interface DailyPoint {
  date: string;
  tokens: number;
  runs: number;
}
interface PerAgent {
  agentId: string;
  agentName: string;
  runs: number;
  tokens: number;
  lastRunAt: string;
}
interface PerIntegration {
  platform: string;
  incoming: number;
  outgoing: number;
  tokens: number;
}
interface Plan {
  name: string;
  dailyTokenLimit: number;
  maxAgents: number;
  tokensUsedToday: number;
  agentCount: number;
}
interface AnalyticsResponse {
  totals: Totals;
  daily: DailyPoint[];
  perAgent: PerAgent[];
  perIntegration: PerIntegration[];
  plan: Plan;
}

// GET /api/analytics?uid=<firebaseUid>
// Returns aggregated usage stats for the user over the last 30 days:
// - totals (runs/tokens/avg duration/success rate)
// - daily series (tokens + runs per day, gaps filled with zero)
// - perAgent breakdown (top 10 by runs)
// - perIntegration breakdown (grouped by platform)
// - plan + current limits
export async function GET(req: NextRequest): Promise<NextResponse<AnalyticsResponse | { error: string }>> {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({
    where: { firebaseUid: uid },
    select: {
      id: true,
      plan: true,
      dailyTokenLimit: true,
      maxAgents: true,
      tokensUsedToday: true,
    },
  });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 30-day window
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // --- Totals (last 30 days of RunHistory) ---
  const runs = await db.runHistory.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    select: { agentId: true, tokens: true, duration: true, status: true, createdAt: true },
  });

  const totalRuns = runs.length;
  const totalTokens = runs.reduce((sum, r) => sum + r.tokens, 0);
  const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0);
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDuration / totalRuns) : 0;
  const successCount = runs.filter((r) => r.status === "completed").length;
  const successRate = totalRuns > 0 ? successCount / totalRuns : 0;

  // --- Daily series (UsageRecord, last 30 days, gaps filled with zero) ---
  const sinceDate = since.toISOString().slice(0, 10);
  const dailyRecords = await db.usageRecord.findMany({
    where: { userId: user.id, date: { gte: sinceDate } },
    orderBy: { date: "asc" },
  });
  const dailyMap = new Map(dailyRecords.map((r) => [r.date, r] as const));
  const daily: DailyPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rec = dailyMap.get(d);
    daily.push({ date: d, tokens: rec?.tokens ?? 0, runs: rec?.runs ?? 0 });
  }

  // --- Per-agent breakdown (top 10 by runs) ---
  const perAgentMap = new Map<string, { runs: number; tokens: number; lastRunAt: Date }>();
  for (const r of runs) {
    const cur = perAgentMap.get(r.agentId) ?? { runs: 0, tokens: 0, lastRunAt: new Date(0) };
    cur.runs += 1;
    cur.tokens += r.tokens;
    if (r.createdAt > cur.lastRunAt) cur.lastRunAt = r.createdAt;
    perAgentMap.set(r.agentId, cur);
  }

  const agentIds = Array.from(perAgentMap.keys());
  const agentRows = agentIds.length > 0
    ? await db.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const agentNameMap = new Map(agentRows.map((a) => [a.id, a.name] as const));

  const perAgent: PerAgent[] = Array.from(perAgentMap.entries())
    .map(([agentId, s]) => ({
      agentId,
      agentName: agentNameMap.get(agentId) ?? "Deleted agent",
      runs: s.runs,
      tokens: s.tokens,
      lastRunAt: s.lastRunAt.toISOString(),
    }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10);

  // --- Per-integration breakdown (grouped by platform) ---
  // MessageLog has no direct userId — go via user's agents → integrations.
  const userAgents = await db.agent.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const userAgentIds = userAgents.map((a) => a.id);

  const integrations = userAgentIds.length > 0
    ? await db.integration.findMany({
        where: { agentId: { in: userAgentIds } },
        select: { id: true, platform: true },
      })
    : [];
  const integrationIds = integrations.map((i) => i.id);
  const integrationPlatform = new Map(integrations.map((i) => [i.id, i.platform] as const));

  const messages = integrationIds.length > 0
    ? await db.messageLog.findMany({
        where: { integrationId: { in: integrationIds }, createdAt: { gte: since } },
        select: { integrationId: true, direction: true, tokens: true },
      })
    : [];

  const perIntegrationMap = new Map<string, { incoming: number; outgoing: number; tokens: number }>();
  for (const m of messages) {
    const platform = integrationPlatform.get(m.integrationId) ?? "unknown";
    const cur = perIntegrationMap.get(platform) ?? { incoming: 0, outgoing: 0, tokens: 0 };
    if (m.direction === "incoming") cur.incoming += 1;
    else if (m.direction === "outgoing") cur.outgoing += 1;
    cur.tokens += m.tokens;
    perIntegrationMap.set(platform, cur);
  }

  const perIntegration: PerIntegration[] = Array.from(perIntegrationMap.entries())
    .map(([platform, s]) => ({ platform, ...s }))
    .sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing));

  // --- Plan & limits ---
  const agentCount = await db.agent.count({ where: { userId: user.id } });

  return NextResponse.json({
    totals: {
      runs: totalRuns,
      tokens: totalTokens,
      avgDurationMs,
      successRate,
    },
    daily,
    perAgent,
    perIntegration,
    plan: {
      name: user.plan,
      dailyTokenLimit: user.dailyTokenLimit,
      maxAgents: user.maxAgents,
      tokensUsedToday: user.tokensUsedToday,
      agentCount,
    },
  });
}
