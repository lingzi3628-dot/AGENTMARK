"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search, Star, Download, Rocket, Store, ChevronLeft, ChevronRight,
  TrendingUp, Clock, Award, Tag, Loader2, User,
} from "lucide-react";

import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/constants";
import type { TemplateShare, Agent } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PublishTemplateDialog } from "./publish-template-dialog";

interface MarketListResponse {
  items: TemplateShare[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type Sort = "installs" | "rating" | "recent";

const TAB_VALUES = ["all", ...CATEGORIES] as const;

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatPrice(cents: number): string {
  if (cents <= 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full;
        const isHalf = !filled && i === full && half;
        return (
          <Star
            key={i}
            className={cn(
              sz,
              filled || isHalf
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        );
      })}
    </div>
  );
}

export function MarketplaceView() {
  const { user } = useAuth();
  const { agents, upsertAgent, setActiveAgent, setView } = useStudio();

  const [items, setItems] = useState<TemplateShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof TAB_VALUES)[number]>("all");
  const [sort, setSort] = useState<Sort>("installs");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selected, setSelected] = useState<TemplateShare | null>(null);
  const [installing, setInstalling] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [userRating, setUserRating] = useState(0);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: category === "all" ? "" : category,
        q: query,
        sort,
        page: String(page),
        limit: "20",
      });
      const res = await fetch(`/api/marketplace?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load marketplace");
      const data = (await res.json()) as MarketListResponse;
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Could not load marketplace templates");
    } finally {
      setLoading(false);
    }
  }, [category, query, sort, page]);

  useEffect(() => {
    const id = setTimeout(fetchList, 250); // debounce search
    return () => clearTimeout(id);
  }, [fetchList]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [category, query, sort]);

  async function handleInstall(t: TemplateShare) {
    if (!user?.firebaseUid) {
      toast.error("Sign in to install templates");
      return;
    }
    setInstalling(true);
    try {
      const res = await fetch(`/api/marketplace/${t.slug}/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.firebaseUid }),
      });
      const data = (await res.json()) as Agent | { error: string };
      if (!res.ok) {
        throw new Error((data as { error: string }).error ?? "Install failed");
      }
      const agent = data as Agent;
      upsertAgent(agent);
      // Bump local install count for snappy UI
      setItems((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, installs: x.installs + 1 } : x)),
      );
      toast.success(`Installed "${t.name}"`, {
        description: "Opening in Studio…",
      });
      setActiveAgent(agent);
      setView("studio");
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }

  async function handleRate(t: TemplateShare, rating: number) {
    if (!user?.firebaseUid) {
      toast.error("Sign in to rate");
      return;
    }
    try {
      const res = await fetch(`/api/marketplace/${t.slug}/rate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.firebaseUid, rating }),
      });
      const data = (await res.json()) as { rating?: number; ratingCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Rating failed");
      setUserRating(rating);
      // Update local item
      const updated = {
        ...t,
        rating: data.rating ?? t.rating,
        ratingCount: data.ratingCount ?? t.ratingCount,
      };
      setSelected(updated);
      setItems((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      toast.success(`Rated ${rating} ★`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rating failed");
    }
  }

  // When a template is selected, reset local rating state
  useEffect(() => {
    if (selected) setUserRating(0);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showPublishCta = agents.length > 0;

  const sortLabel = useMemo(() => {
    return (
      <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
        <SelectTrigger className="h-9 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="installs">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Most Installed
            </span>
          </SelectItem>
          <SelectItem value="rating">
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" /> Top Rated
            </span>
          </SelectItem>
          <SelectItem value="recent">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Newest
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }, [sort]);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Hero header */}
      <header className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Store className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                AGENTMARK Marketplace
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Discover, install, and publish community-built agents. One-click
              install — your new agent opens in the Studio ready to run.
            </p>
          </div>
          {showPublishCta && (
            <Button onClick={() => setPublishOpen(true)} className="gap-1.5">
              <Rocket className="h-4 w-4" />
              Publish Your Agent
            </Button>
          )}
        </div>

        {/* Search + sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates, authors, tags…"
              className="pl-9"
              aria-label="Search marketplace"
            />
          </div>
          {sortLabel}
        </div>

        {/* Category tabs */}
        <div className="flex w-full flex-wrap gap-1.5">
          {TAB_VALUES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      {/* Loading skeleton */}
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
      ) : items.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-base font-medium">No templates found</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try a different search term or category. Or be the first — publish
            your own agent to the marketplace.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setSort("installs");
            }}
          >
            Clear filters
          </Button>
        </section>
      ) : (
        <section
          aria-label="Marketplace templates"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {items.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.32), ease: "easeOut" }}
            >
              <Card
                role="button"
                tabIndex={0}
                onClick={() => setSelected(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(t);
                  }
                }}
                className="group flex h-full cursor-pointer flex-col gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon name={t.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                      <Badge
                        variant="default"
                        className={cn(
                          "shrink-0",
                          t.priceCents > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {formatPrice(t.priceCents)}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {t.authorAvatar ? (
                    <img
                      src={t.authorAvatar}
                      alt={t.authorName}
                      className="h-5 w-5 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                      <User className="h-3 w-3" />
                    </span>
                  )}
                  <span className="truncate">{t.authorName || "Anonymous"}</span>
                </div>

                {/* Tags */}
                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-muted text-muted-foreground"
                      >
                        <Tag className="mr-1 h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {formatInstalls(t.installs)}
                    </span>
                    {t.ratingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Stars rating={t.rating} />
                        <span className="text-[11px]">({t.ratingCount})</span>
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstall(t);
                    }}
                  >
                    Install
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </section>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="px-3 text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="mb-2 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Icon name={selected.icon} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-lg">{selected.name}</DialogTitle>
                    <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs">
                      <span>by</span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        {selected.authorAvatar && (
                          <img
                            src={selected.authorAvatar}
                            alt={selected.authorName}
                            className="h-4 w-4 rounded-full object-cover"
                          />
                        )}
                        {selected.authorName || "Anonymous"}
                      </span>
                      <Badge
                        variant="default"
                        className={cn(
                          "ml-1",
                          selected.priceCents > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {formatPrice(selected.priceCents)}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selected.description}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="text-base font-semibold">{formatInstalls(selected.installs)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Installs</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Stars rating={selected.rating} size="md" />
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {selected.rating.toFixed(1)} ({selected.ratingCount})
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="text-base font-semibold">{selected.nodes.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nodes</div>
                  </div>
                </div>

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-muted text-muted-foreground">
                        <Tag className="mr-1 h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Rating widget */}
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-1.5 text-xs font-medium">Rate this template</div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => handleRate(selected, r)}
                        className="rounded-md p-1 transition-transform hover:scale-110"
                        aria-label={`Rate ${r} stars`}
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 transition-colors",
                            r <= userRating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-transparent text-muted-foreground hover:text-amber-400",
                          )}
                        />
                      </button>
                    ))}
                    {userRating > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Thanks for rating!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => handleInstall(selected)} disabled={installing}>
                  {installing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Installing…
                    </>
                  ) : (
                    <>
                      <Download className="mr-1.5 h-4 w-4" />
                      Install Agent
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PublishTemplateDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        agents={agents}
        firebaseUid={user?.firebaseUid}
        onPublished={() => {
          // Refresh the list to show the newly published template
          fetchList();
        }}
      />
    </div>
  );
}
