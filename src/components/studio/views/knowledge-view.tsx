"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Plus, Link as LinkIcon, Trash2, Database, FileText, File, Globe,
  Loader2, Sparkles, Layers,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import type { KnowledgeItem, AgentDocument } from "@/lib/types";

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

// === RAG document types ===
type DocType = "text" | "url" | "markdown";

const DOC_TYPE_ICON: Record<DocType, typeof FileText> = {
  text: FileText,
  url: Globe,
  markdown: File,
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

// === RAG upload dialog ===
function UploadDocumentDialog({
  open,
  onOpenChange,
  onCreated,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (doc: AgentDocument) => void;
  children?: React.ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<DocType>("text");
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
      const res = await fetch(
        `/api/agents/${useStudio.getState().activeAgentId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            type,
            source: source.trim(),
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to upload document");
      }
      const created = (await res.json()) as AgentDocument;
      onCreated(created);
      toast.success(`Document indexed (${created.chunkCount} chunks)`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document (RAG)</DialogTitle>
          <DialogDescription>
            Documents are chunked + embedded with all-MiniLM-L6-v2 and used for
            semantic retrieval when a Knowledge node has RAG enabled.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Spec v2"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocType)}>
              <SelectTrigger id="doc-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-source">Source (optional)</Label>
            <Input
              id="doc-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com/docs or filename.md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-content">Content</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the document content here..."
              rows={8}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Content &gt; 100K chars is truncated. ~1s embedding time per 1K tokens.
            </p>
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
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Indexing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Upload & Index
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// === Documents (RAG) section ===
function DocumentsRagSection() {
  const { agents, activeAgentId, setActiveAgent } = useStudio();
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);

  const selectedAgentId = activeAgentId ?? agents[0]?.id ?? null;

  useEffect(() => {
    if (!selectedAgentId) {
      setDocs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/agents/${selectedAgentId}/documents`);
        if (!res.ok) throw new Error("Failed to load documents");
        const data = (await res.json()) as AgentDocument[];
        if (!cancelled) setDocs(data);
      } catch {
        if (!cancelled) toast.error("Could not load RAG documents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  function handleCreated(doc: AgentDocument) {
    setDocs((prev) => [doc, ...prev]);
  }

  async function handleDelete(id: string) {
    if (!selectedAgentId) return;
    setDeletingId(id);
    const previous = docs;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await fetch(
        `/api/agents/${selectedAgentId}/documents/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Document removed");
    } catch {
      setDocs(previous);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  // No agents case — the user hasn't created any agents yet.
  if (agents.length === 0) {
    return (
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Documents (RAG)</h2>
          <Badge variant="secondary" className="ml-auto">per-agent</Badge>
        </div>
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Create an agent first to upload documents for semantic retrieval.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Documents (RAG)</h2>
            <Badge variant="secondary" className="ml-1">per-agent</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Indexed documents are retrieved by Knowledge nodes with RAG enabled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedAgentId ?? ""}
            onValueChange={(v) => {
              const a = agents.find((x) => x.id === v) ?? null;
              setActiveAgent(a);
            }}
          >
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UploadDocumentDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onCreated={handleCreated}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Upload Document
              </Button>
            </DialogTrigger>
          </UploadDocumentDialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading RAG documents">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No documents indexed for this agent yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a document to enable semantic retrieval in Knowledge nodes.
          </p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto studio-scroll pr-1">
          {docs.map((doc) => {
            const TypeIcon = DOC_TYPE_ICON[(doc.type as DocType) ?? "text"] ?? FileText;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{doc.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {doc.type}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
                    </span>
                    {doc.source && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{doc.source}</span>
                      </span>
                    )}
                    <span className="shrink-0">
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${doc.title}`}
                  disabled={deletingId === doc.id || indexingId === doc.id}
                  onClick={() => handleDelete(doc.id)}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
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

  const knowledgeItemsList = useMemo(() => items, [items]);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* === Section 1: Knowledge Store (global, pre-existing) === */}
        <section className="space-y-4">
          {/* Header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
              className="space-y-3"
            >
              {Array.from({ length: 3 }).map((_, i) => (
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
          ) : knowledgeItemsList.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-medium">No knowledge yet</h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Add your first document, note, or link to start giving your agents context.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add your first knowledge
              </Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto studio-scroll pr-1">
              <ul className="space-y-3">
                {knowledgeItemsList.map((item) => {
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
        </section>

        {/* === Section 2: Documents (RAG) — per-agent semantic retrieval === */}
        <DocumentsRagSection />
      </div>
    </div>
  );
}
