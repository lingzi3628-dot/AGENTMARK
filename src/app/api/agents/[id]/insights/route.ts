import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/agents/[id]/insights — AI-powered performance insights for an agent.
// Analyzes run history + cost + errors and returns actionable insights.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Fetch last 100 runs
  const runs = await db.runHistory.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (runs.length === 0) {
    return NextResponse.json({
      insights: [],
      summary: "No runs yet — execute this agent to generate insights.",
      stats: { totalRuns: 0, successRate: 0, avgTokens: 0, totalCostCents: 0 },
    });
  }

  // Compute stats
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === "completed");
  const failedRuns = runs.filter((r) => r.status === "error");
  const successRate = Math.round((successfulRuns.length / totalRuns) * 100);
  const avgTokens = Math.round(runs.reduce((s, r) => s + r.tokens, 0) / totalRuns);
  const totalCostCents = runs.reduce((s, r) => s + r.costCents, 0);
  const avgDurationMs = Math.round(runs.reduce((s, r) => s + r.duration, 0) / totalRuns);

  // Time-based analysis
  const now = Date.now();
  const last24h = runs.filter((r) => now - r.createdAt.getTime() < 24 * 60 * 60 * 1000);
  const last7d = runs.filter((r) => now - r.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000);
  const last24hSuccessRate = last24h.length > 0
    ? Math.round((last24h.filter((r) => r.status === "completed").length / last24h.length) * 100)
    : 0;

  // Token trend (last 10 runs)
  const recentRuns = runs.slice(0, 10).reverse();
  const tokenTrend = recentRuns.map((r) => r.tokens);
  const tokenTrendUp = tokenTrend.length >= 2 && tokenTrend[tokenTrend.length - 1] > tokenTrend[0] * 1.2;
  const tokenTrendDown = tokenTrend.length >= 2 && tokenTrend[tokenTrend.length - 1] < tokenTrend[0] * 0.8;

  // Generate insights (rule-based for speed — could use AI for richer analysis)
  const insights: Array<{
    type: "positive" | "warning" | "critical" | "info";
    title: string;
    description: string;
    metric?: string;
  }> = [];

  if (successRate < 50) {
    insights.push({
      type: "critical",
      title: "Low success rate",
      description: `This agent fails ${100 - successRate}% of the time. Check the workflow for error-prone nodes or add retry logic.`,
      metric: `${successRate}% success`,
    });
  } else if (successRate >= 95) {
    insights.push({
      type: "positive",
      title: "Excellent reliability",
      description: `This agent has a ${successRate}% success rate across ${totalRuns} runs.`,
      metric: `${successRate}% success`,
    });
  }

  if (last24hSuccessRate < successRate - 20) {
    insights.push({
      type: "warning",
      title: "Success rate dropping",
      description: `Success rate in the last 24h (${last24hSuccessRate}%) is significantly lower than the overall average (${successRate}%). Something may have broken recently.`,
      metric: `${last24hSuccessRate}% → ${successRate}%`,
    });
  }

  if (tokenTrendUp) {
    insights.push({
      type: "warning",
      title: "Token usage increasing",
      description: `Token usage has increased ~20%+ over the last ${recentRuns.length} runs. Consider shorter system prompts or lighter models.`,
      metric: `${tokenTrend[0]} → ${tokenTrend[tokenTrend.length - 1]} tokens`,
    });
  } else if (tokenTrendDown) {
    insights.push({
      type: "positive",
      title: "Token usage decreasing",
      description: `Token usage has dropped ~20%+ over the last ${recentRuns.length} runs. The agent is becoming more efficient.`,
      metric: `${tokenTrend[0]} → ${tokenTrend[tokenTrend.length - 1]} tokens`,
    });
  }

  if (totalCostCents > 100) {
    insights.push({
      type: "info",
      title: "Cost summary",
      description: `This agent has cost $${(totalCostCents / 100).toFixed(2)} across ${totalRuns} runs (avg $${(totalCostCents / totalRuns / 100).toFixed(4)}/run).`,
      metric: `$${(totalCostCents / 100).toFixed(2)} total`,
    });
  }

  if (avgDurationMs > 10000) {
    insights.push({
      type: "warning",
      title: "Slow execution",
      description: `Average run takes ${(avgDurationMs / 1000).toFixed(1)}s. Consider using faster models (glm-4.5-air) or removing unnecessary nodes.`,
      metric: `${(avgDurationMs / 1000).toFixed(1)}s avg`,
    });
  }

  if (totalRuns >= 10 && last7d.length === 0) {
    insights.push({
      type: "info",
      title: "Inactive agent",
      description: `This agent hasn't been run in the last 7 days despite having ${totalRuns} total runs. Consider archiving it.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "Healthy agent",
      description: `No issues detected. The agent is performing within normal parameters across ${totalRuns} runs.`,
    });
  }

  // Generate summary
  const summary = `${totalRuns} runs · ${successRate}% success · avg ${avgTokens} tokens · $${(totalCostCents / 100).toFixed(2)} total cost · ${(avgDurationMs / 1000).toFixed(1)}s avg duration`;

  return NextResponse.json({
    insights,
    summary,
    stats: {
      totalRuns,
      successRate,
      avgTokens,
      totalCostCents,
      avgDurationMs,
      last24hRuns: last24h.length,
      last7dRuns: last7d.length,
      failedRuns: failedRuns.length,
    },
    tokenTrend,
  });
}
