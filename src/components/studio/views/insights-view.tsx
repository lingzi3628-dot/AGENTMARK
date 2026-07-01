"use client";

import { useEffect, useState, useCallback } from "react";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, ChevronRight, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Info, Zap, Clock, DollarSign, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Insight {
  type: "positive" | "warning" | "critical" | "info";
  title: string;
  description: string;
  metric?: string;
}

interface InsightsData {
  insights: Insight[];
  summary: string;
  stats: {
    totalRuns: number;
    successRate: number;
    avgTokens: number;
    totalCostCents: number;
    avgDurationMs: number;
    last24hRuns: number;
    last7dRuns: number;
    failedRuns: number;
  };
  tokenTrend: number[];
}

const TYPE_CONFIG: Record<Insight["type"], { icon: typeof CheckCircle2; color: string; bg: string }> = {
  positive: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  critical: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

export function InsightsView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeAgent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}/insights`);
      if (!res.ok) throw new Error("Failed to load insights");
      const result = (await res.json()) as InsightsData;
      setData(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load insights");
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
              <Brain className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agent selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an agent to see AI-powered performance insights.
              </p>
            </div>
            {agents.length > 0 ? (
              <div className="w-full max-w-sm space-y-1">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAgent(a); setView("insights"); }}
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

  const stats = data?.stats;
  const maxToken = Math.max(...(data?.tokenTrend || [1]), 1);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agent Insights</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                AI-powered performance analysis for <span className="font-medium text-foreground">{activeAgent.name}</span>
              </p>
              {data && <p className="mt-1 text-xs text-muted-foreground">{data.summary}</p>}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : !data ? null : (
          <>
            {/* Stats grid */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Activity} label="Total runs" value={stats.totalRuns} color="text-primary" />
                <StatCard
                  icon={CheckCircle2}
                  label="Success rate"
                  value={`${stats.successRate}%`}
                  color={stats.successRate >= 90 ? "text-emerald-500" : stats.successRate >= 70 ? "text-amber-500" : "text-red-500"}
                />
                <StatCard icon={Zap} label="Avg tokens" value={stats.avgTokens} color="text-purple-500" />
                <StatCard
                  icon={DollarSign}
                  label="Total cost"
                  value={`$${(stats.totalCostCents / 100).toFixed(2)}`}
                  color="text-amber-500"
                />
                <StatCard
                  icon={Clock}
                  label="Avg duration"
                  value={`${(stats.avgDurationMs / 1000).toFixed(1)}s`}
                  color="text-blue-500"
                />
                <StatCard icon={Activity} label="Last 24h" value={stats.last24hRuns} color="text-cyan-500" />
                <StatCard icon={Activity} label="Last 7 days" value={stats.last7dRuns} color="text-teal-500" />
                <StatCard
                  icon={AlertTriangle}
                  label="Failed runs"
                  value={stats.failedRuns}
                  color={stats.failedRuns > 0 ? "text-red-500" : "text-muted-foreground"}
                />
              </div>
            )}

            {/* Token trend mini-chart */}
            {data.tokenTrend.length >= 2 && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-primary" /> Token trend (last {data.tokenTrend.length} runs)
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {data.tokenTrend[data.tokenTrend.length - 1] > data.tokenTrend[0] ? (
                      <TrendingUp className="h-3 w-3 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-emerald-500" />
                    )}
                    {data.tokenTrend[0]} → {data.tokenTrend[data.tokenTrend.length - 1]}
                  </div>
                </div>
                <div className="mt-3 flex items-end gap-1 h-16">
                  {data.tokenTrend.map((tokens, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors"
                      style={{ height: `${(tokens / maxToken) * 100}%`, minHeight: "2px" }}
                      title={`${tokens} tokens`}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Insights list */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {data.insights.length} insight{data.insights.length !== 1 ? "s" : ""}
              </h3>
              <div className="space-y-3">
                {data.insights.map((insight, i) => {
                  const cfg = TYPE_CONFIG[insight.type];
                  const Icon = cfg.icon;
                  return (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", cfg.bg)}>
                          <Icon className={cn("h-4 w-4", cfg.color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-medium">{insight.title}</h4>
                            <Badge variant="outline" className={cn("text-[10px] capitalize", cfg.color, cfg.bg, "border-transparent")}>
                              {insight.type}
                            </Badge>
                            {insight.metric && (
                              <span className="text-xs font-medium text-muted-foreground">{insight.metric}</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string | number; color: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn("h-3 w-3", color)} /> {label}
      </div>
      <div className={cn("mt-1 text-lg font-semibold", color)}>{value}</div>
    </Card>
  );
}
