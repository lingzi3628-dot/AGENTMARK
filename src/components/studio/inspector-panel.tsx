"use client";

import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Trash2, X, Settings2 } from "lucide-react";
import { MODELS, TOOLS } from "@/lib/constants";
import type { NodeKind } from "@/lib/types";

const KIND_LABEL: Record<NodeKind, string> = {
  trigger: "Trigger Node",
  model: "Language Model Node",
  tool: "Tool Node",
  knowledge: "Knowledge Node",
  output: "Output Node",
};

export function InspectorPanel() {
  const { nodes, selectedNodeId, setSelectedNode, updateNodeData, removeNode } = useStudio();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="flex h-full w-80 flex-col items-center justify-center gap-2 border-l border-border bg-card/50 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings2 className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">No node selected</p>
        <p className="text-xs text-muted-foreground">
          Click a node on the canvas to edit its properties.
        </p>
      </div>
    );
  }

  const d = node.data;

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon name={iconFor(d.kind)} className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{KIND_LABEL[d.kind]}</div>
          <div className="text-[11px] text-muted-foreground">id: {node.id}</div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedNode(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto studio-scroll p-4">
        <div className="space-y-1.5">
          <Label htmlFor="label" className="text-xs">Label</Label>
          <Input
            id="label"
            value={d.label}
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            placeholder="Node name"
            className="h-8 text-sm"
          />
        </div>

        {d.kind === "trigger" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Input description</Label>
            <Textarea
              value={d.content ?? ""}
              onChange={(e) => updateNodeData(node.id, { content: e.target.value })}
              placeholder="Describe what the user provides…"
              rows={3}
              className="text-sm"
            />
          </div>
        )}

        {d.kind === "model" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={d.provider ?? "glm-4.5-air"} onValueChange={(v) => updateNodeData(node.id, { provider: v as typeof d.provider })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{m.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">System prompt</Label>
              <Textarea
                value={d.systemPrompt ?? ""}
                onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })}
                placeholder="You are a helpful AI agent…"
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperature</Label>
                <span className="text-xs text-muted-foreground">{d.temperature ?? 0.7}</span>
              </div>
              <Slider
                value={[d.temperature ?? 0.7]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={([v]) => updateNodeData(node.id, { temperature: v })}
              />
            </div>
          </>
        )}

        {d.kind === "tool" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tool</Label>
            <Select value={d.tool ?? "web-search"} onValueChange={(v) => updateNodeData(node.id, { tool: v as typeof d.tool })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOOLS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-medium">{t.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              {TOOLS.find((t) => t.id === (d.tool ?? "web-search"))?.description}
            </p>
          </div>
        )}

        {d.kind === "knowledge" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Content</Label>
            <Textarea
              value={d.content ?? ""}
              onChange={(e) => updateNodeData(node.id, { content: e.target.value })}
              placeholder="Paste documents, context, or reference text…"
              rows={8}
              className="text-sm"
            />
          </div>
        )}

        {d.kind === "output" && (
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            The output node returns the final result of the workflow. Connect a model or tool node into it.
          </p>
        )}
      </div>

      <Separator />
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => removeNode(node.id)}
        >
          <Trash2 className="h-4 w-4" /> Delete node
        </Button>
      </div>
    </div>
  );
}

function iconFor(kind: NodeKind): string {
  switch (kind) {
    case "trigger": return "play";
    case "model": return "sparkles";
    case "tool": return "wrench";
    case "knowledge": return "database";
    case "output": return "flag";
  }
}
