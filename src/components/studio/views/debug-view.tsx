"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug, Play, Loader2, ChevronRight, CheckCircle2, XCircle, Clock,
  AlertCircle, ArrowRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NodeOutput {
  nodeId: string;
  label: string;
  kind: string;
  output: string;
  status: string;
  durationMs: number;
  tokens?: number;
  error?: string;
}

interface DebugResult {
  ok: boolean;
  sampleInput: string;
  finalOutput: string;
  totalTokens: number;
  durationMs: number;
  nodeCount: number;
  edgeCount: number;
  nodeOutputs: NodeOutput[];
  error?: string;
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

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  done: { icon: CheckCircle2, color: "text-emerald-500", label: "Done" },
  error: { icon: XCircle, color: "text-red-500", label: "Error" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  skipped: { icon: Clock, color: "text-muted-foreground", label: "Skipped" },
  idle: { icon: Clock, color: "text-muted-foreground", label: "Idle" },
};

export function DebugView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();
  const [sampleInput, setSampleInput] = useState("Hello, what can you help me with?");
  const [stopAtNodeId, setStopAtNodeId] = useState("all");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);

  async function runDebug() {
    if (!activeAgent) return;
    setRunning(true);
    setResult(null);
    try {
      const body: Record<string, string> = { sampleInput };
      if (stopAtNodeId !== "all") body.nodeId = stopAtNodeId;

      const res = await fetch(`/api/agents/${activeAgent.id}/debug`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Debug run failed");
      const data = (await res.json()) as DebugResult;
      setResult(data);
      if (data.ok) {
        toast.success(`Debug complete — ${data.durationMs}ms, ${data.totalTokens} tokens`);
      } else {
        toast.error(`Debug failed: ${data.error || "unknown error"}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Debug run failed";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bug className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agent selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an agent to debug its workflow with sample input.
              </p>
            </div>
            {agents.length > 0 ? (
              <div className="w-full max-w-sm space-y-1">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAgent(a); setView("debug"); }}
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

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Bug className="h-5 w-5 text-primary" />
                Debug Workflow
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Run <span className="font-medium text-foreground">{activeAgent.name}</span> with sample input and see per-node outputs.
              </p>
            </div>
            <Button onClick={runDebug} disabled={running} className="gap-1.5">
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
              ) : (
                <><Play className="h-4 w-4" /> Run Debug</>
              )}
            </Button>
          </div>
        </Card>

        {/* Input config */}
        <Card className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Sample input</Label>
            <Textarea
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              placeholder="Type the test message you want to send to the agent…"
              rows={3}
              className="text-sm"
            />
          </div>

          {activeAgent.nodes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Stop at node (optional — for partial debugging)</Label>
              <Select value={stopAtNodeId} onValueChange={setStopAtNodeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Run full workflow</SelectItem>
                  {activeAgent.nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.data?.label || n.id} ({n.data?.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Stops after the selected node — useful for debugging a specific part of the workflow.
              </p>
            </div>
          )}
        </Card>

        {/* Results */}
        {result && (
          <>
            {/* Summary bar */}
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">{result.ok ? "Run succeeded" : "Run failed"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {result.durationMs}ms
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" /> {result.totalTokens} tokens
                </div>
                <div className="text-muted-foreground">
                  {result.nodeCount} nodes · {result.edgeCount} edges
                </div>
              </div>
              {result.error && (
                <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" /> {result.error}
                  </p>
                </div>
              )}
            </Card>

            {/* Final output */}
            {result.finalOutput && (
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Final output</h3>
                <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs font-mono">
                  {result.finalOutput}
                </pre>
              </Card>
            )}

            {/* Per-node outputs */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Per-node outputs ({result.nodeOutputs.length})
              </h3>
              <div className="space-y-3">
                {result.nodeOutputs.map((node, i) => {
                  const statusCfg = STATUS_CONFIG[node.status] || STATUS_CONFIG.idle;
                  const StatusIcon = statusCfg.icon;
                  const kindColor = KIND_COLORS[node.kind] || "bg-muted text-muted-foreground";
                  return (
                    <Card key={node.nodeId} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{node.label}</span>
                            <Badge variant="outline" className={cn("text-[10px]", kindColor)}>
                              {node.kind}
                            </Badge>
                            <span className={cn("flex items-center gap-1 text-xs", statusCfg.color)}>
                              <StatusIcon className={cn("h-3 w-3", node.status === "running" && "animate-spin")} />
                              {statusCfg.label}
                            </span>
                            {node.tokens !== undefined && node.tokens > 0 && (
                              <span className="text-xs text-muted-foreground">{node.tokens} tok</span>
                            )}
                          </div>

                          {node.error && (
                            <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
                              <p className="text-xs text-red-500">{node.error}</p>
                            </div>
                          )}

                          {node.output && (
                            <div className="mt-2">
                              <p className="mb-1 text-[11px] text-muted-foreground">Output:</p>
                              <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs font-mono max-h-48 overflow-y-auto studio-scroll">
                                {node.output.slice(0, 1000)}{node.output.length > 1000 ? "…" : ""}
                              </pre>
                            </div>
                          )}

                          {!node.output && !node.error && node.status === "skipped" && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Node was skipped (not in the execution path).
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !running && (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bug className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">Ready to debug</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Enter sample input above and click "Run Debug" to see the output of every node in your workflow.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
