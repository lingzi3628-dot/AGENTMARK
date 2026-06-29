"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Workflow, Play, Pin, Trash2, Sparkles, Clock,
  ArrowRight, Search, Zap, Copy, Download, Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agent, WorkflowNode, WorkflowEdge } from "@/lib/types";
import { CATEGORIES } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";

type SortKey = "recent" | "name-asc" | "name-desc" | "nodes-desc";

export function DashboardView({ onOpenStudio }: { onOpenStudio: () => void }) {
  const { agents, setAgents, upsertAgent, removeAgent, setActiveAgent, setView } = useStudio();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) setAgents((await res.json()) as Agent[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [setAgents]);

  const filtered = agents
    .filter((a) => {
      const q = query.toLowerCase();
      const matchesQuery =
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q);
      const matchesCategory = category === "all" || a.category === category;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "nodes-desc":
          return b.nodes.length - a.nodes.length;
        case "recent":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  async function createBlank() {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Untitled Agent", description: "" }),
      });
      if (!res.ok) throw new Error("create failed");
      const agent = (await res.json()) as Agent;
      upsertAgent(agent);
      setActiveAgent(agent);
      setView("studio");
      toast.success("New agent created", { description: "Open the Studio to design its workflow." });
    } catch {
      toast.error("Could not create agent");
    }
  }

  async function duplicate(a: Agent) {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${a.name} (copy)`,
          description: a.description,
          icon: a.icon,
          category: a.category,
          nodes: a.nodes,
          edges: a.edges,
        }),
      });
      if (!res.ok) throw new Error("duplicate failed");
      const created = (await res.json()) as Agent;
      upsertAgent(created);
      toast.success("Agent duplicated");
    } catch {
      toast.error("Could not duplicate agent");
    }
  }

  function exportAgent(a: Agent) {
    try {
      const payload = {
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        nodes: a.nodes,
        edges: a.edges,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${a.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success("Agent exported");
    } catch {
      toast.error("Could not export agent");
    }
  }

  async function importAgent(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<{
        name: unknown;
        description: unknown;
        icon: unknown;
        category: unknown;
        nodes: unknown;
        edges: unknown;
      }>;
      if (
        typeof data.name !== "string" ||
        !Array.isArray(data.nodes) ||
        !Array.isArray(data.edges)
      ) {
        toast.error("Invalid agent file — missing name, nodes, or edges");
        return;
      }
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: typeof data.description === "string" ? data.description : "",
          icon: typeof data.icon === "string" ? data.icon : "sparkles",
          category: typeof data.category === "string" ? data.category : "custom",
          nodes: data.nodes as WorkflowNode[],
          edges: data.edges as WorkflowEdge[],
        }),
      });
      if (!res.ok) throw new Error("import failed");
      const created = (await res.json()) as Agent;
      upsertAgent(created);
      toast.success("Agent imported");
    } catch {
      toast.error("Could not import agent");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function togglePin(a: Agent) {
    const updated = { ...a, pinned: !a.pinned };
    upsertAgent(updated);
    fetch(`/api/agents/${a.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !a.pinned }),
    }).catch(() => toast.error("Failed to update"));
  }

  async function deleteAgent(a: Agent) {
    const prev = agents;
    removeAgent(a.id);
    toast.success("Agent deleted", { description: a.name });
    try {
      await fetch(`/api/agents/${a.id}`, { method: "DELETE" });
    } catch {
      setAgents(prev);
      toast.error("Delete failed — restored");
    }
  }

  function open(a: Agent) {
    setActiveAgent(a);
    setView("studio");
  }
  function run(a: Agent) {
    setActiveAgent(a);
    setView("run");
  }

  const pinned = filtered.filter((a) => a.pinned);
  const others = filtered.filter((a) => !a.pinned);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Hidden file input for JSON import — single instance, always mounted */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importAgent(file);
        }}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Workflow} label="Agents" value={agents.length} accent="primary" />
          <StatCard icon={Pin} label="Pinned" value={agents.filter((a) => a.pinned).length} accent="accent" />
          <StatCard icon={Sparkles} label="Nodes" value={agents.reduce((s, a) => s + a.nodes.length, 0)} accent="muted" />
          <StatCard icon={Zap} label="Models" value={4} accent="primary" />
        </div>

        {/* Create hero */}
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Build your first AI agent</h2>
                <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
                  Drag nodes onto the canvas, connect them, and compose multi-model workflows visually.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView("templates")}>
                Browse templates
              </Button>
              <Button onClick={createBlank} className="gap-1.5">
                <Plus className="h-4 w-4" /> New Agent
              </Button>
            </div>
          </div>
        </Card>

        {/* Search + filters */}
        {agents.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents…"
                aria-label="Search agents"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger size="sm" className="w-[150px]" aria-label="Filter by category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger size="sm" className="w-[140px]" aria-label="Sort agents">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="nodes-desc">Most nodes</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import agent from JSON"
              >
                <Upload className="h-4 w-4" /> Import
              </Button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filtered.length} of {agents.length}
              </span>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-44 animate-pulse bg-muted/40" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && agents.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Workflow className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No agents yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a blank agent, start from a template, or import one.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setView("templates")}>Templates</Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Import
              </Button>
              <Button onClick={createBlank} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create agent
              </Button>
            </div>
          </Card>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Pin className="h-3.5 w-3.5" /> Pinned
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pinned.map((a) => (
                <AgentCard
                  key={a.id}
                  a={a}
                  onOpen={() => open(a)}
                  onRun={() => run(a)}
                  onPin={() => togglePin(a)}
                  onDuplicate={() => duplicate(a)}
                  onExport={() => exportAgent(a)}
                  onDelete={() => deleteAgent(a)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Others */}
        {others.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {pinned.length > 0 ? "All agents" : "Your agents"}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {others.map((a) => (
                <AgentCard
                  key={a.id}
                  a={a}
                  onOpen={() => open(a)}
                  onRun={() => run(a)}
                  onPin={() => togglePin(a)}
                  onDuplicate={() => duplicate(a)}
                  onExport={() => exportAgent(a)}
                  onDelete={() => deleteAgent(a)}
                />
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {!loading && agents.length > 0 && filtered.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Search className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No agents match your filters</p>
            <p className="text-xs text-muted-foreground">
              Try a different search, category, or sort.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setSortBy("recent");
              }}
            >
              Clear filters
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: IconCmp, label, value, accent }: { icon: LucideIcon; label: string; value: number; accent: "primary" | "accent" | "muted" }) {
  const tones = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tones[accent])}>
        <IconCmp className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function AgentCard({
  a, onOpen, onRun, onPin, onDuplicate, onExport, onDelete,
}: {
  a: Agent;
  onOpen: () => void;
  onRun: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group flex flex-col gap-3 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start gap-3">
        <button
          onClick={onOpen}
          aria-label={`Open ${a.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary transition-transform group-hover:scale-105"
        >
          <Icon name={a.icon} className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={onOpen} className="block w-full text-left">
            <h4 className="truncate font-semibold leading-tight hover:text-primary">{a.name}</h4>
          </button>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {a.description || "No description"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Workflow className="h-3 w-3" /> {a.nodes.length} nodes
        </Badge>
        <Badge variant="outline" className="capitalize">{a.category}</Badge>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-3">
        <Button size="sm" variant="default" onClick={onRun} className="gap-1.5">
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
        <Button size="sm" variant="outline" onClick={onOpen} className="gap-1.5">
          Edit <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onDuplicate}
            aria-label="Duplicate agent"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onExport}
            aria-label="Export agent as JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8", a.pinned && "text-primary")}
            onClick={onPin}
            aria-label={a.pinned ? "Unpin agent" : "Pin agent"}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete agent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
