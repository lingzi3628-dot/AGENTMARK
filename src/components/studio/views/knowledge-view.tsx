"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, Link as LinkIcon, Trash2, Database, FileText, File, Globe } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KnowledgeType = "text" | "file" | "url";

const TYPE_BADGE_CLASS: Record<KnowledgeType, string> = {
  text: "bg-muted text-muted-foreground border-transparent",
  file: "bg-primary/12 text-primary border-primary/20",
  url: "bg-accent text-accent-foreground border-accent-foreground/15",
};

const TYPE_ICON: Record<KnowledgeType, typeof FileText> = {
  text: FileText,
  file: File,
  url: Globe,
};

function NewItemDialog({
  open,
  onOpenChange,
  onCreated,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (item: KnowledgeItem) => void;
  children?: React.ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<KnowledgeType>("text");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setContent("");
    setType("text");
    setSource("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          type,
          source: source.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create knowledge item");
      const created = (await res.json()) as KnowledgeItem;
      onCreated(created);
      toast.success("Knowledge item added");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to add knowledge item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge</DialogTitle>
          <DialogDescription>
            Add context, documents, or links that your agents can reference.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kn-title">Title</Label>
            <Input
              id="kn-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product FAQ"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kn-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as KnowledgeType)}
            >
              <SelectTrigger id="kn-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kn-content">Content</Label>
            <Textarea
              id="kn-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write the knowledge content..."
              rows={5}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kn-source">Source (optional)</Label>
            <Input
              id="kn-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com or file name"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Knowledge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgeView() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/knowledge");
        if (!res.ok) throw new Error("Failed to load knowledge");
        const data = (await res.json()) as KnowledgeItem[];
        if (cancelled) return;
        setItems(data);
      } catch {
        if (!cancelled) toast.error("Could not load knowledge store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(item: KnowledgeItem) {
    setItems((prev) => [item, ...prev]);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const previous = items;
    // Optimistic remove
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Knowledge item removed");
    } catch {
      // Rollback
      setItems(previous);
      toast.error("Failed to delete knowledge item");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Database className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Store</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Documents, notes, and links that give your agents context.
          </p>
        </div>

        <NewItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={handleCreated}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add Knowledge
            </Button>
          </DialogTrigger>
        </NewItemDialog>
      </header>

      {/* Loading skeleton */}
      {loading ? (
        <div
          aria-busy="true"
          aria-label="Loading knowledge items"
          className="max-w-4xl space-y-3"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-12 rounded-md" />
              </div>
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="text-base font-medium">No knowledge yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first document, note, or link to start giving your agents context they can
            use.
          </p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add your first knowledge
          </Button>
        </section>
      ) : (
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto studio-scroll pr-1">
          <ul className="max-w-4xl space-y-3">
            {items.map((item) => {
              const TypeIcon = TYPE_ICON[item.type];
              return (
                <li key={item.id}>
                  <Card className="gap-0 p-4 transition-colors hover:border-primary/30">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <TypeIcon className="h-3.5 w-3.5" />
                        </span>
                        <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn("uppercase tracking-wide", TYPE_BADGE_CLASS[item.type])}
                      >
                        {item.type}
                      </Badge>
                    </div>

                    {/* Content preview */}
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.content || "—"}
                    </p>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {item.source && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.source}</span>
                          </span>
                        )}
                        <span className="shrink-0">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${item.title}`}
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
