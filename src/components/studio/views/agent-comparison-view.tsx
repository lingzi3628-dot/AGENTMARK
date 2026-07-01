"use client";

import { useState, useMemo } from "react";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Tag, Clock, Zap, DollarSign, TrendingUp, GitCompare, Loader2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Agent } from "@/lib/types";

type SortKey = "recent" | "name-asc" | "runs-desc" | "tokens-desc" | "cost-desc";
type TagFilter = string;

export function AgentComparisonView() {
  const { agents, setActiveAgent, setView } = useStudio();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  // Collect all tags from all agents
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    agents.forEach((a) => {
      (a as Agent & { tags?: string[] }).tags?.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [agents]);

  const filtered = agents
    .filter((a) => {
      const q = query.toLowerCase();
      const matchesQuery = a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      const matchesTag = tagFilter === "all" || (a as Agent & { tags?: string[] }).tags?.includes(tagFilter);
      return matchesQuery && matchesTag;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "runs-desc": return (b.runs?.length || 0) - (a.runs?.length || 0);
        default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  const selectedAgents = agents.filter((a) => selected.has(a.id));

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else toast("Max 4 agents for comparison");
      return next;
    });
  }

  function toast(msg: string) {
    import("sonner").then(({ toast: t }) => t.info(msg));
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agent Comparison</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Select up to 4 agents to compare their stats side-by-side.
              </p>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents…"
                className="h-9 pl-9 text-sm"
              />
            </div>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[150px]" size="sm">
                  <Tag className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="runs-desc">Most runs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Agent grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const isSelected = selected.has(a.id);
            return (
              <Card
                key={a.id}
                className={cn(
                  "cursor-pointer p-4 transition-all",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40",
                )}
                onClick={() => toggleSelect(a.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/12 text-primary text-xs font-medium">
                    {isSelected ? "✓" : a.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium">{a.name}</h4>
                    <p className="truncate text-xs text-muted-foreground">{a.nodes.length} nodes</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        {selectedAgents.length >= 2 && (
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Comparing {selectedAgents.length} agents
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Metric</th>
                    {selectedAgents.map((a) => (
                      <th key={a.id} className="py-2 px-4 text-left text-xs font-medium">
                        <button
                          className="text-primary hover:underline"
                          onClick={() => { setActiveAgent(a); setView("studio"); }}
                        >
                          {a.name}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">Nodes</td>
                    {selectedAgents.map((a) => (
                      <td key={a.id} className="py-2 px-4">{a.nodes.length}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">Updated</td>
                    {selectedAgents.map((a) => (
                      <td key={a.id} className="py-2 px-4 text-xs">
                        {formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
