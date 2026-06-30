"use client";

import { useEffect, useState, useCallback } from "react";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, ChevronRight, AlertTriangle, Clock, Zap, TrendingDown,
  RefreshCw, Loader2, Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NodeAggregation {
  nodeId: string;
  nodeLabel: string;
  nodeKind: string;
  avgDurationMs: number;
  maxDurationMs: number;
  totalDurationMs: number;
  totalTokens: number;
  runCount: number;
  errorCount: number;
  errorRate: number;
}

interface NodeMetricsResult {
  agentId: string;
  nodes: NodeAggregation[];
  totalRuns: number;
  slowestNode: NodeAggregation | null;
  highestErrorRate: NodeAggregation | null;
}

const KIND_COLORS: Record<string, string> = {
  trigger: "bg-blue-500/15 text-blue-500",
  model: "bg-emerald-500/15 text-emerald-500",
  tool: "bg-purple-500/15 text-purple-500",
  knowledge: "bg-amber-500/15 text-amber-500",
  output: "bg-pink-500/15 text-pink-500",
  approval: "bg-orange-500/15 text-orange-500",
  "sub-agent": "bg-violet-500/15 text-violet-500",
  code: "bg-yellow-500/15 text-yellow-500",
  router: "bg-cyan-500/15 text-cyan-500",
  memory: "bg-teal-500/15 text-teal-500",
  "image-gen": "bg-fuchsia-500/15 text-fuchsia-500",
  vision: "bg-indigo-500/15 text-indigo-500",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function NodeMetricsView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();
  const [data, setData] = useState<NodeMetricsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeAgent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}/node-metrics`);
      if (!res.ok) throw new Error("Failed to load metrics");
      const result = (await res.json()) as NodeMetricsResult;
      setData(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [activeAgent]);

  useEffect(() => {
    if (activeAgent) void load();
  }, [activeAgent?.id, load]);

  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agent selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an agent to see per-node performance metrics.
              </p>
            </div>
            {agents.length > 0 ? (
              <div className="w-full max-w-sm space-y-1">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAgent(a); setView("node-metrics"); }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{a.nodes.length} nodes</span>
                  </button>
                ))}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setView("dashboard")}>Go to Dashboard</Button>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const nodes = data?.nodes || [];
  const maxAvgDuration = Math.max(...nodes.map((n) => n.avgDurationMs), 1);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Activity className="h-5 w-5 text-primary" />
                Node Performance
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Per-node timing + error rates for <span className="font-medium text-foreground">{activeAgent.name}</span>
              </p>
            </div>
            <Button onClick={load} disabled={loading} variant="outline" size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </Card>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Total runs
              </div>
              <div className="mt-1 text-xl font-semibold">{data.totalRuns}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Slowest node
              </div>
              <div className="mt-1 truncate text-sm font-medium">
                {data.slowestNode?.nodeLabel || "—"}
              </div>
              {data.slowestNode && (
                <div className="text-xs text-amber-500">{formatDuration(data.slowestNode.avgDurationMs)} avg</div>
              )}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Highest error rate
              </div>
              <div className="mt-1 truncate text-sm font-medium">
                {data.highestErrorRate?.nodeLabel || "—"}
              </div>
              {data.highestErrorRate && data.highestErrorRate.errorRate > 0 && (
                <div className="text-xs text-red-500">
                  {(data.highestErrorRate.errorRate * 100).toFixed(0)}% errors
                </div>
              )}
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Nodes tracked
              </div>
              <div className="mt-1 text-xl font-semibold">{nodes.length}</div>
            </Card>
          </div>
        )}

        {/* Node breakdown */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No metrics yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Run this agent a few times to collect per-node performance data. Metrics are tracked in-memory per server instance.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setView("run")}>
              Go to Run view
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <TrendingDown className="h-4 w-4" /> Bottlenecks (sorted by avg duration)
            </h3>
            {nodes.map((node, i) => {
              const kindColor = KIND_COLORS[node.nodeKind] || "bg-muted text-muted-foreground";
              const durationPct = Math.round((node.avgDurationMs / maxAvgDuration) * 100);
              const hasHighErrorRate = node.errorRate > 0.1 && node.runCount > 2;
              return (
                <Card key={node.nodeId} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{node.nodeLabel}</span>
                        <Badge variant="outline" className={cn("text-[10px]", kindColor)}>
                          {node.nodeKind}
                        </Badge>
                        {hasHighErrorRate && (
                          <Badge variant="outline" className="text-[10px] border-red-500/30 bg-red-500/15 text-red-500">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {Math.round(node.errorRate * 100)}% errors
                          </Badge>
                        )}
                      </div>

                      {/* Duration bar */}
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Avg: {formatDuration(node.avgDurationMs)}</span>
                          <span>Max: {formatDuration(node.maxDurationMs)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              durationPct > 75 ? "bg-red-500" : durationPct > 40 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${durationPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>{node.runCount} runs</span>
                        <span>{node.errorCount} errors</span>
                        {node.totalTokens > 0 && <span>{node.totalTokens} tokens</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
