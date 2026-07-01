"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  BookMarked, Plus, Trash2, Copy, Search, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PromptEntry {
  id: string;
  title: string;
  category: string;
  prompt: string;
  createdAt: string;
}

const STORAGE_KEY = "agentmark.prompt_library";

const CATEGORIES = ["General", "Customer Support", "Code", "Writing", "Analysis", "Research", "Sales", "Other"];

const DEFAULT_PROMPTS: PromptEntry[] = [
  {
    id: "default-1",
    title: "Helpful Assistant",
    category: "General",
    prompt: "You are a helpful, friendly assistant. Respond clearly and concisely. If you don't know something, say so honestly.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-2",
    title: "Customer Support Agent",
    category: "Customer Support",
    prompt: "You are a customer support agent. Be empathetic, professional, and solution-focused. Always acknowledge the customer's concern, then provide clear steps to resolve it.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-3",
    title: "Code Reviewer",
    category: "Code",
    prompt: "You are an expert code reviewer. Review code for: 1) Bugs, 2) Security issues, 3) Performance, 4) Best practices, 5) Readability. Rate severity (low/medium/high) for each finding.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-4",
    title: "Content Writer",
    category: "Writing",
    prompt: "You are a professional content writer. Write engaging, well-structured content. Use headings, bullet points, and examples. Adapt tone to the target audience.",
    createdAt: new Date().toISOString(),
  },
];

export function PromptLibraryView() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: "", category: "General", prompt: "" });

  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrompts(JSON.parse(stored) as PromptEntry[]);
      } else {
        setPrompts(DEFAULT_PROMPTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROMPTS));
      }
    } catch {
      setPrompts(DEFAULT_PROMPTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function savePrompts(updated: PromptEntry[]) {
    setPrompts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function addPrompt() {
    if (!newPrompt.title.trim() || !newPrompt.prompt.trim()) {
      toast.error("Title and prompt are required");
      return;
    }
    const entry: PromptEntry = {
      id: `prompt-${Date.now()}`,
      title: newPrompt.title.trim(),
      category: newPrompt.category,
      prompt: newPrompt.prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    savePrompts([entry, ...prompts]);
    toast.success("Prompt saved");
    setShowAdd(false);
    setNewPrompt({ title: "", category: "General", prompt: "" });
  }

  function deletePrompt(id: string) {
    savePrompts(prompts.filter((p) => p.id !== id));
    toast.success("Prompt deleted");
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const filtered = prompts.filter((p) => {
    const matchesQuery = p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.prompt.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "all" || p.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BookMarked className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Prompt Library</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Save reusable system prompts for your agents.
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4" /> New Prompt
            </Button>
          </div>
        </Card>

        {/* Add form */}
        {showAdd && (
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={newPrompt.title}
                  onChange={(e) => setNewPrompt((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Support Agent v2"
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <select
                  value={newPrompt.category}
                  onChange={(e) => setNewPrompt((p) => ({ ...p, category: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prompt</Label>
              <Textarea
                value={newPrompt.prompt}
                onChange={(e) => setNewPrompt((p) => ({ ...p, prompt: e.target.value }))}
                placeholder="You are a…"
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={addPrompt}>Save Prompt</Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts…"
              className="h-9 pl-9 text-sm"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Prompts */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No prompts found.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{p.title}</h4>
                      <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground font-mono">{p.prompt}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyPrompt(p.prompt)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePrompt(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
