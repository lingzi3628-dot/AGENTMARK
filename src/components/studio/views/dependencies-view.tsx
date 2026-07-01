"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitFork, Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DepNode {
  id: string;
  name: string;
  icon: string;
  isRoot: boolean;
  isOrphan: boolean;
}

interface DepEdge {
  source: string;
  target: string;
}

interface DepData {
  nodes: (DepNode & { isOrphan: boolean })[];
  edges: DepEdge[];
  stats: {
    totalAgents: number;
    totalDependencies: number;
    rootAgents: number;
    orphanAgents: number;
  };
}

export function DependenciesView() {
  const { user } = useAuth();
  const { setActiveAgent, setView } = useStudio();
  const [data, setData] = useState<DepData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/dependencies?uid=${user.firebaseUid}`);
      if (res.ok) {
        setData((await res.json()) as DepData);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  // Build a map of outgoing edges per node
  const outgoingMap = new Map<string, DepEdge[]>();
  const incomingMap = new Map<string, DepEdge[]>();
  if (data) {
    for (const edge of data.edges) {
      if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
      outgoingMap.get(edge.source)!.push(edge);
      if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
      incomingMap.get(edge.target)!.push(edge);
    }
  }

  const nodeMap = new Map(data?.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GitFork className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agent Dependencies</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Visualize which agents call other agents via Sub-Agent nodes.
              </p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data || data.nodes.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GitFork className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agents yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create agents with Sub-Agent nodes to see their dependency graph.
              </p>
            </div>
          </Card>
        ) : data.edges.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No dependencies yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                None of your agents use Sub-Agent nodes. Add a Sub-Agent node in the Studio to create a dependency.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setView("studio")}>
              Open Studio <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Total agents</div>
                <div className="mt-1 text-lg font-semibold">{data.stats.totalAgents}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Dependencies</div>
                <div className="mt-1 text-lg font-semibold text-primary">{data.stats.totalDependencies}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Root agents</div>
                <div className="mt-1 text-lg font-semibold text-emerald-500">{data.stats.rootAgents}</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Orphans</div>
                <div className="mt-1 text-lg font-semibold text-muted-foreground">{data.stats.orphanAgents}</div>
              </Card>
            </div>

            {/* Graph visualization (list-based, hierarchical) */}
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Dependency tree
              </h3>
              <div className="space-y-3">
                {/* Root agents first */}
                {data.nodes
                  .filter((n) => n.isRoot)
                  .map((node) => (
                    <DepTreeNode
                      key={node.id}
                      node={node}
                      outgoingMap={outgoingMap}
                      nodeMap={nodeMap}
                      depth={0}
                      onOpen={(id) => {
                        const agent = data.nodes.find((n) => n.id === id);
                        if (agent) {
                          // We need to fetch the full agent to set it active
                          fetch(`/api/agents`).then((r) => r.json()).then((agents) => {
                            const full = agents.find((a: { id: string }) => a.id === id);
                            if (full) {
                              setActiveAgent(full);
                              setView("studio");
                            }
                          });
                        }
                      }}
                    />
                  ))}
              </div>

              {/* Orphan agents (not connected to anything) */}
              {data.stats.orphanAgents > 0 && (
                <>
                  <div className="mt-6 mb-3 text-xs font-medium text-muted-foreground">
                    Standalone agents (no dependencies)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.nodes
                      .filter((n) => n.isOrphan)
                      .map((node) => (
                        <Badge key={node.id} variant="outline" className="gap-1">
                          {node.name}
                        </Badge>
                      ))}
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function DepTreeNode({
  node,
  outgoingMap,
  nodeMap,
  depth,
  onOpen,
}: {
  node: DepNode;
  outgoingMap: Map<string, DepEdge[]>;
  nodeMap: Map<string, DepNode & { isOrphan: boolean }>;
  depth: number;
  onOpen: (id: string) => void;
}) {
  const children = outgoingMap.get(node.id) || [];

  return (
    <div style={{ marginLeft: `${depth * 24}px` }}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-primary text-xs font-medium">
          {depth === 0 ? "◆" : "→"}
        </div>
        <span className="text-sm font-medium">{node.name}</span>
        {depth === 0 && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
            Root
          </Badge>
        )}
        {children.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            calls {children.length}
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={() => onOpen(node.id)}
        >
          Open <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((edge) => {
            const childNode = nodeMap.get(edge.target);
            if (!childNode) return null;
            return (
              <DepTreeNode
                key={edge.target}
                node={childNode}
                outgoingMap={outgoingMap}
                nodeMap={nodeMap}
                depth={depth + 1}
                onOpen={onOpen}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
