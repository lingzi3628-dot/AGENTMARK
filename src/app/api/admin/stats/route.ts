import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminGuard } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/stats?key=<ADMIN_SECRET_KEY>
// Returns platform-wide statistics.
export async function GET(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const [
    totalUsers, totalAgents, totalRuns, totalApiKeys,
    totalTemplates, totalPublished, totalIntegrations,
    totalMessages, totalSchedules, totalDocuments,
  ] = await Promise.all([
    db.user.count(),
    db.agent.count(),
    db.runHistory.count(),
    db.apiKey.count(),
    db.template.count(),
    db.publishedAgent.count(),
    db.integration.count(),
    db.messageLog.count(),
    db.schedule.count(),
    db.document.count(),
  ]);

  // Recent registrations (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentUsers = await db.user.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  // Token usage today
  const today = new Date().toISOString().slice(0, 10);
  const todayRuns = await db.runHistory.findMany({
    where: { createdAt: { gte: new Date(today) } },
    select: { tokens: true, costCents: true },
  });
  const tokensToday = todayRuns.reduce((s, r) => s + r.tokens, 0);
  const costTodayCents = todayRuns.reduce((s, r) => s + r.costCents, 0);

  // Last 30 days daily stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRuns = await db.runHistory.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { tokens: true, costCents: true, status: true, createdAt: true, source: true },
  });

  const dailyStats: Record<string, { runs: number; tokens: number; costCents: number; errors: number }> = {};
  for (const run of recentRuns) {
    const date = run.createdAt.toISOString().slice(0, 10);
    if (!dailyStats[date]) dailyStats[date] = { runs: 0, tokens: 0, costCents: 0, errors: 0 };
    dailyStats[date].runs++;
    dailyStats[date].tokens += run.tokens;
    dailyStats[date].costCents += run.costCents;
    if (run.status === "error") dailyStats[date].errors++;
  }

  return NextResponse.json({
    totals: {
      users: totalUsers,
      agents: totalAgents,
      runs: totalRuns,
      apiKeys: totalApiKeys,
      templates: totalTemplates,
      published: totalPublished,
      integrations: totalIntegrations,
      messages: totalMessages,
      schedules: totalSchedules,
      documents: totalDocuments,
      recentUsers7d: recentUsers,
    },
    today: {
      tokens: tokensToday,
      costCents: costTodayCents,
      costUsd: (costTodayCents / 100).toFixed(2),
      runs: todayRuns.length,
    },
    daily: Object.entries(dailyStats).map(([date, stats]) => ({ date, ...stats })),
  });
}
