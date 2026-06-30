// Per-node performance metrics — records duration + tokens + status for each node
// during an agent run. Used by the analytics dashboard for bottleneck detection.

export interface NodeMetric {
  nodeId: string;
  nodeLabel: string;
  nodeKind: string;
  agentId: string;
  durationMs: number;
  tokens: number;
  status: "done" | "error" | "skipped";
  timestamp: number;
}

// In-process store (per server lifetime). For production with multiple instances,
// this should be moved to the DB. For now, in-memory is sufficient for analytics.
const nodeMetrics: NodeMetric[] = [];
const MAX_METRICS = 5000; // cap to prevent memory bloat

export function recordNodeMetric(metric: NodeMetric): void {
  nodeMetrics.push(metric);
  if (nodeMetrics.length > MAX_METRICS) {
    nodeMetrics.splice(0, nodeMetrics.length - MAX_METRICS);
  }
}

export function getAgentNodeMetrics(agentId: string, limit = 500): NodeMetric[] {
  return nodeMetrics
    .filter((m) => m.agentId === agentId)
    .slice(-limit);
}

export function getAllNodeMetrics(limit = 5000): NodeMetric[] {
  return nodeMetrics.slice(-limit);
}

export function clearNodeMetrics(): void {
  nodeMetrics.length = 0;
}

/**
 * Aggregate per-node metrics for an agent — returns avg duration, total tokens,
 * error rate, and run count for each node.
 */
export interface NodeAggregation {
  nodeId: string;
  nodeLabel: string;
  nodeKind: string;
  avgDurationMs: number;
  maxDurationMs: number;
  totalDurationMs: number;
  totalTokens: number;
  runCount: number;
  errorCount: number;
  errorRate: number; // 0-1
}

export function aggregateNodeMetrics(agentId: string): NodeAggregation[] {
  const metrics = getAgentNodeMetrics(agentId);
  const byNode = new Map<string, NodeMetric[]>();

  for (const m of metrics) {
    const key = m.nodeId;
    if (!byNode.has(key)) byNode.set(key, []);
    byNode.get(key)!.push(m);
  }

  const aggregations: NodeAggregation[] = [];
  for (const [nodeId, nodeMetrics] of byNode) {
    const durations = nodeMetrics.map((m) => m.durationMs).filter((d) => d > 0);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const totalTokens = nodeMetrics.reduce((a, b) => a + b.tokens, 0);
    const errorCount = nodeMetrics.filter((m) => m.status === "error").length;

    aggregations.push({
      nodeId,
      nodeLabel: nodeMetrics[0]?.nodeLabel || nodeId,
      nodeKind: nodeMetrics[0]?.nodeKind || "unknown",
      avgDurationMs: durations.length > 0 ? Math.round(totalDuration / durations.length) : 0,
      maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      totalDurationMs: totalDuration,
      totalTokens,
      runCount: nodeMetrics.length,
      errorCount,
      errorRate: nodeMetrics.length > 0 ? errorCount / nodeMetrics.length : 0,
    });
  }

  // Sort by avg duration desc (bottlenecks first)
  aggregations.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  return aggregations;
}
