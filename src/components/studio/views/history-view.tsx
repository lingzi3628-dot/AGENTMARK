"use client";

import { useEffect, useState, useCallback } from "react";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  GitBranch,
  GitCommit,
  Clock,
  RotateCcw,
  Eye,
  Plus,
  Loader2,
  ChevronRight,
  Code2,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface AgentVersion {
  id: string;
  version: number;
  branch: string;
  message: string;
  createdById: string | null;
  createdAt: string;
  name: string;
  description: string;
}

interface BranchInfo {
  branch: string;
  latestVersion: number;
  versionCount: number;
}

export function HistoryView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();
  const { user } = useAuth();
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [loading, setLoading] = useState(true);
  const [viewingVersion, setViewingVersion] = useState<AgentVersion | null>(null);
  const [viewData, setViewData] = useState<{ nodes: unknown[]; edges: unknown[] } | null>(null);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchFromVersion, setNewBranchFromVersion] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!activeAgent) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/agents/${activeAgent.id}/versions?branch=${encodeURIComponent(selectedBranch)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as AgentVersion[];
        setVersions(data);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [activeAgent, selectedBranch]);

  const loadBranches = useCallback(async () => {
    if (!activeAgent) return;
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}/branches`);
      if (res.ok) {
        const data = (await res.json()) as BranchInfo[];
        setBranches(data);
        if (data.length > 0 && !data.find((b) => b.branch === selectedBranch)) {
          setSelectedBranch("main");
        }
      }
    } catch {
      // non-fatal
    }
  }, [activeAgent, selectedBranch]);

  useEffect(() => {
    void loadVersions();
    void loadBranches();
  }, [loadVersions, loadBranches]);

  async function viewVersion(v: AgentVersion) {
    setViewingVersion(v);
    setViewData(null);
    try {
      const res = await fetch(`/api/agents/${activeAgent!.id}/versions/${v.id}`);
      if (res.ok) {
        const data = await res.json();
        setViewData({ nodes: data.nodes || [], edges: data.edges || [] });
      }
    } catch {
      toast.error("Failed to load version");
    }
  }

  async function restoreVersion(v: AgentVersion) {
    setRestoring(v.id);
    try {
      const res = await fetch(
        `/api/agents/${activeAgent!.id}/versions/${v.id}/restore`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      const updated = await res.json();
      // Update the active agent in the store
      if (activeAgent) {
        setActiveAgent({
          ...activeAgent,
          nodes: updated.nodes || activeAgent.nodes,
          edges: updated.edges || activeAgent.edges,
        });
      }
      toast.success(`Restored from v${v.version}`, {
        description: "A new version was created on main with this graph.",
      });
      void loadVersions();
      void loadBranches();
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoring(null);
    }
  }

  async function createBranch() {
    if (!newBranchName.trim() || !newBranchFromVersion) {
      toast.error("Branch name and source version are required");
      return;
    }
    try {
      const res = await fetch(`/api/agents/${activeAgent!.id}/branches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromVersionId: newBranchFromVersion,
          branchName: newBranchName.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Branch "${newBranchName}" created`);
      setShowNewBranch(false);
      setNewBranchName("");
      setNewBranchFromVersion("");
      void loadBranches();
      setSelectedBranch(newBranchName.trim());
    } catch {
      toast.error("Failed to create branch");
    }
  }

  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto max-w-2xl">
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HistoryIcon className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agent selected</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select an agent to view its version history and branches.
              </p>
            </div>
            {agents.length > 0 ? (
              <div className="w-full max-w-sm space-y-1">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setActiveAgent(a);
                      setView("history");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">v{a.currentVersion || 1}</span>
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

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <GitBranch className="h-5 w-5 text-primary" />
                {activeAgent.name}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Version history & branches — every save is snapshot automatically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]" size="sm">
                  <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.length === 0 ? (
                    <SelectItem value="main">main</SelectItem>
                  ) : (
                    branches.map((b) => (
                      <SelectItem key={b.branch} value={b.branch}>
                        {b.branch} ({b.versionCount})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowNewBranch(true)}
              >
                <Plus className="h-3.5 w-3.5" /> New Branch
              </Button>
            </div>
          </div>
        </Card>

        {/* Versions timeline */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            {selectedBranch} branch — {versions.length} version{versions.length !== 1 ? "s" : ""}
          </h3>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <GitCommit className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No versions on this branch yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save your agent in the Studio to create the first version.
              </p>
            </div>
          ) : (
            <div className="relative space-y-3">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
              {versions.map((v, idx) => (
                <div key={v.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                      idx === 0 ? "border-primary text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    <GitCommit className="h-4 w-4" />
                  </div>
                  {/* Version card */}
                  <div className="flex-1 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{v.version}</span>
                          {idx === 0 && (
                            <Badge className="bg-primary/15 text-primary text-[10px]">Latest</Badge>
                          )}
                          {v.branch !== "main" && (
                            <Badge variant="outline" className="text-[10px]">{v.branch}</Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {v.message || "No commit message"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-xs"
                          onClick={() => viewVersion(v)}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          disabled={restoring === v.id || selectedBranch !== "main"}
                          onClick={() => restoreVersion(v)}
                          title={selectedBranch !== "main" ? "Switch to main branch to restore" : "Restore this version"}
                        >
                          {restoring === v.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* View Version Dialog */}
      <Dialog open={!!viewingVersion} onOpenChange={(v) => !v && setViewingVersion(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {viewingVersion?.branch} · v{viewingVersion?.version}
            </DialogTitle>
            <DialogDescription>
              {viewingVersion?.message || "No commit message"} —{" "}
              {viewingVersion && formatDistanceToNow(new Date(viewingVersion.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto studio-scroll max-h-[60vh]">
            {!viewData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : viewData.nodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No nodes in this version.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Code2 className="h-4 w-4 text-primary" />
                  {viewData.nodes.length} nodes · {viewData.edges.length} edges
                </div>
                {viewData.nodes.map((node, i) => {
                  const n = node as { id: string; data: { label: string; kind: string } };
                  return (
                    <div
                      key={n.id || i}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                    >
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {n.data?.kind || "unknown"}
                      </Badge>
                      <span className="text-sm">{n.data?.label || "Unnamed"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Branch Dialog */}
      <Dialog open={showNewBranch} onOpenChange={setShowNewBranch}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Create New Branch
            </DialogTitle>
            <DialogDescription>
              Branch from an existing version to experiment without affecting main.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Branch name</Label>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="experiment-1"
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Branch from</Label>
              <Select value={newBranchFromVersion} onValueChange={setNewBranchFromVersion}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      v{v.version} — {v.message || "no message"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBranch(false)}>Cancel</Button>
            <Button onClick={createBranch} disabled={!newBranchName.trim() || !newBranchFromVersion}>
              <Plus className="h-4 w-4" /> Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
