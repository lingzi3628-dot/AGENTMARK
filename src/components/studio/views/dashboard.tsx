"use client";

import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Workflow, Play, Pin, Trash2, Sparkles, Clock,
  ArrowRight, Search, Zap, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export function DashboardView({ onOpenStudio }: { onOpenStudio: () => void }) {
  const { agents, setAgents, upsertAgent, removeAgent, setActiveAgent, setView } = useStudio();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) setAgents((await res.json()) as Agent[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase()),
  );

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

        {/* Search */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents…"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} of {agents.length}</span>
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
                Create a blank agent or start from a template.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView("templates")}>Templates</Button>
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
                <AgentCard key={a.id} a={a} onOpen={() => open(a)} onRun={() => run(a)} onPin={() => togglePin(a)} onDelete={() => deleteAgent(a)} />
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
                <AgentCard key={a.id} a={a} onOpen={() => open(a)} onRun={() => run(a)} onPin={() => togglePin(a)} onDelete={() => deleteAgent(a)} />
              ))}
            </div>
          </section>
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
  a, onOpen, onRun, onPin, onDelete,
}: {
  a: Agent;
  onOpen: () => void;
  onRun: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="group flex flex-col gap-3 p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary transition-transform group-hover:scale-105">
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
          <Button size="icon" variant="ghost" className={cn("h-8 w-8", a.pinned && "text-primary")} onClick={onPin} aria-label="Pin">
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
