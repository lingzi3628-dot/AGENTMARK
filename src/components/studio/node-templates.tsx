"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Layers, Plus, Trash2, Copy, Search, Loader2, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

const STORAGE_KEY = "agentmark.node_templates";

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  node: WorkflowNode;
  createdAt: string;
}

export function NodeTemplatesView({ onUse }: { onUse: (node: WorkflowNode) => void }) {
  const [templates, setTemplates] = useState<NodeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "" });
  const [pendingNode, setPendingNode] = useState<WorkflowNode | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTemplates(JSON.parse(stored) as NodeTemplate[]);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function saveTemplate() {
    if (!newTemplate.name.trim() || !pendingNode) {
      toast.error("Name and a node are required");
      return;
    }
    const template: NodeTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplate.name.trim(),
      description: newTemplate.description.trim(),
      node: pendingNode,
      createdAt: new Date().toISOString(),
    };
    const updated = [template, ...templates];
    setTemplates(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Node template saved");
    setShowAdd(false);
    setNewTemplate({ name: "", description: "" });
    setPendingNode(null);
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Template deleted");
  }

  function applyTemplate(template: NodeTemplate) {
    // Clone the node with a new ID
    const newNode: WorkflowNode = {
      ...template.node,
      id: `${template.node.data.kind}-${Date.now()}`,
      data: { ...template.node.data },
      position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
    };
    onUse(newNode);
    toast.success(`Added: ${template.name}`);
  }

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Layers className="h-4 w-4" /> Templates ({templates.length})
        </h3>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3" /> Save Current
        </Button>
      </div>

      {templates.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="h-8 pl-7 text-xs"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {templates.length === 0
            ? "No templates yet. Save a node config for reuse."
            : "No templates match your search."}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto studio-scroll">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">{tpl.name}</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{tpl.node.data.kind}</Badge>
                </div>
                {tpl.description && (
                  <p className="truncate text-[10px] text-muted-foreground">{tpl.description}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => applyTemplate(tpl)}
                title="Use template"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => deleteTemplate(tpl.id)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Save dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Save Node Template
            </DialogTitle>
            <DialogDescription>
              Save the currently selected node for reuse in other agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Template name</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
                placeholder="e.g. GLM-4.6 with web search"
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={newTemplate.description}
                onChange={(e) => setNewTemplate((t) => ({ ...t, description: e.target.value }))}
                placeholder="What does this node do?"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={!newTemplate.name.trim()}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
