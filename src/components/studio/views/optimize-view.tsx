"use client";

import { useEffect, useState, useCallback } from "react";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, TrendingUp, Zap, Shield, Lightbulb, ArrowRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Suggestion {
  type: "cost" | "latency" | "reliability" | "best-practice";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  nodeId?: string;
  estimatedSavings?: string;
}

interface OptimizeResult {
  suggestions: Suggestion[];
  overallScore: number;
  summary: string;
}

const TYPE_CONFIG: Record<Suggestion["type"], { icon: typeof TrendingUp; color: string; label: string }> = {
  cost: { icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10", label: "Cost" },
  latency: { icon: Zap, color: "text-amber-500 bg-amber-500/10", label: "Latency" },
  reliability: { icon: Shield, color: "text-blue-500 bg-blue-500/10", label: "Reliability" },
  "best-practice": { icon: Lightbulb, color: "text-purple-500 bg-purple-500/10", label: "Best Practice" },
};

const SEVERITY_CONFIG: Record<Suggestion["severity"], string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function OptimizeView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!activeAgent) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}/optimize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = (await res.json()) as OptimizeResult;
      setResult(data);
      toast.success(`Found ${data.suggestions.length} suggestions`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [activeAgent]);

  // Auto-analyze when agent changes
  useEffect(() => {
    if (activeAgent) {
      setResult(null);
      setError(null);
    }
  }, [activeAgent?.id]);

  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wand2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agent selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an agent to analyze its workflow for improvements.
              </p>
            </div>
            {agents.length > 0 ? (
              <div className="w-full max-w-sm space-y-1">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setActiveAgent(a);
                      setView("optimize");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{a.nodes.length} nodes</span>
                  </button>
                ))}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setView("dashboard")}>
                Go to Dashboard
              </Button>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const score = result?.overallScore ?? 0;
  const scoreColor = score >= 75 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const scoreBg = score >= 75 ? "bg-emerald-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Wand2 className="h-5 w-5 text-primary" />
                AI Workflow Optimizer
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Analyzing: <span className="font-medium text-foreground">{activeAgent.name}</span> ({activeAgent.nodes.length} nodes)
              </p>
            </div>
            <Button onClick={analyze} disabled={analyzing} className="gap-1.5">
              {analyzing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Wand2 className="h-4 w-4" /> {result ? "Re-analyze" : "Analyze Workflow"}</>
              )}
            </Button>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </Card>
        )}

        {/* Loading state */}
        {analyzing && !result && (
          <Card className="p-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI is analyzing your workflow…</p>
              <p className="text-xs text-muted-foreground">Checking cost, latency, reliability, and best practices.</p>
            </div>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Score + Summary */}
            <Card className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className={cn("flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl", scoreBg)}>
                  <div className="text-center">
                    <div className={cn("text-2xl font-bold", scoreColor)}>{score}</div>
                    <div className="text-[10px] text-muted-foreground">/ 100</div>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Overall Score</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> {result.suggestions.filter(s => s.severity === "low").length} low
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> {result.suggestions.filter(s => s.severity === "medium").length} medium
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> {result.suggestions.filter(s => s.severity === "high").length} high
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Suggestions */}
            {result.suggestions.length === 0 ? (
              <Card className="p-8 text-center">
                <Lightbulb className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium">No improvements needed!</p>
                <p className="mt-1 text-xs text-muted-foreground">Your workflow looks well-optimized.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {result.suggestions.length} suggestion{result.suggestions.length !== 1 ? "s" : ""}
                </h3>
                {result.suggestions.map((s, i) => {
                  const cfg = TYPE_CONFIG[s.type] || TYPE_CONFIG["best-practice"];
                  const Icon = cfg.icon;
                  return (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", cfg.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px]", SEVERITY_CONFIG[s.severity])}>
                              {s.severity}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {cfg.label}
                            </Badge>
                            {s.estimatedSavings && (
                              <span className="text-xs font-medium text-emerald-500">
                                💰 {s.estimatedSavings}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1.5 text-sm font-medium">{s.title}</h4>
                          <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                          {s.nodeId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 h-7 gap-1 text-xs"
                              onClick={() => {
                                useStudio.getState().setSelectedNode(s.nodeId!);
                                setView("studio");
                              }}
                            >
                              Jump to node <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !analyzing && !error && (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wand2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">Ready to optimize</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Click "Analyze Workflow" to get AI-powered suggestions for reducing cost, improving latency, and following best practices.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
