import { NextRequest, NextResponse } from "next/server";
import { aggregateNodeMetrics } from "@/lib/node-metrics";

export const dynamic = "force-dynamic";

// Get per-node performance metrics for an agent — bottleneck detection.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aggregations = aggregateNodeMetrics(id);
  return NextResponse.json({
    agentId: id,
    nodes: aggregations,
    totalRuns: aggregations.reduce((sum, n) => sum + n.runCount, 0),
    slowestNode: aggregations[0] || null,
    highestErrorRate: aggregations
      .filter((n) => n.runCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)[0] || null,
  });
}
