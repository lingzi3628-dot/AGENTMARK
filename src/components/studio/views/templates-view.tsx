"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useStudio } from "@/lib/store";
import { CATEGORIES } from "@/lib/constants";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { Agent, Template } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["all", ...CATEGORIES] as const;

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof TAB_VALUES)[number]>("all");
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) throw new Error("Failed to load templates");
        const data = (await res.json()) as Template[];
        if (cancelled) return;
        setTemplates(data);
      } catch {
        if (!cancelled) toast.error("Could not load templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      const haystack = `${t.name} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [templates, query, category]);

  async function handleUseTemplate(t: Template) {
    setCreatingId(t.id);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          description: t.description,
          icon: t.icon,
          category: t.category,
          templateId: t.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create agent");
      const created = (await res.json()) as Agent;
      // Bump local install count for snappy UI
      setTemplates((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, installs: x.installs + 1 } : x)),
      );
      useStudio.getState().upsertAgent(created);
      useStudio.getState().setActiveAgent(created);
      useStudio.getState().setView("studio");
      toast.success("Agent created from template");
    } catch {
      toast.error("Failed to create agent from template");
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Template Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Start from a pre-built agent. Pick one and it opens in the Studio ready to run.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
            aria-label="Search templates"
          />
        </div>
      </header>

      {/* Category tabs */}
      <Tabs
        value={category}
        onValueChange={(v) => setCategory(v as (typeof TAB_VALUES)[number])}
        className="mb-6"
      >
        <TabsList className="flex h-9 w-full flex-wrap justify-start gap-1 overflow-x-auto sm:w-auto">
          {TAB_VALUES.map((c) => (
            <TabsTrigger key={c} value={c} className="capitalize">
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Loading skeleton grid */}
      {loading ? (
        <section
          aria-busy="true"
          aria-label="Loading templates"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="gap-0 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </Card>
          ))}
        </section>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-base font-medium">No templates found</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try a different search term or category. You can always start from a blank agent in
            the Studio.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear filters
          </Button>
        </section>
      ) : (
        <section
          aria-label="Templates"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.32), ease: "easeOut" }}
            >
              <Card className="group flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40">
                {/* Header: icon + name */}
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon name={t.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                      {t.featured && (
                        <Badge
                          variant="default"
                          className="bg-primary/15 text-primary border-primary/20"
                        >
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-muted text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t.featured ? (
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{formatInstalls(t.installs)} installs</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(t)}
                    disabled={creatingId === t.id}
                    className={cn("min-w-[7rem]")}
                  >
                    {creatingId === t.id ? "Creating..." : "Use Template"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </section>
      )}
    </div>
  );
}
