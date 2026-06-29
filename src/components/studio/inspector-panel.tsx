"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Trash2, X, Settings2, Cpu, Upload, Link2, Plus } from "lucide-react";
import { MODELS, TOOLS, IMAGE_SIZES } from "@/lib/constants";
import { estimateNodeTokens, formatTokens } from "@/lib/tokens";
import type { NodeKind, KnowledgeItem } from "@/lib/types";

const KIND_LABEL: Record<NodeKind, string> = {
  trigger: "Trigger Node",
  model: "Language Model Node",
  tool: "Tool Node",
  knowledge: "Knowledge Node",
  "image-gen": "Image Generator Node",
  vision: "Vision Node",
  router: "Router Node",
  memory: "Memory Node",
  output: "Output Node",
};

export function InspectorPanel() {
  const { nodes, selectedNodeId, setSelectedNode, updateNodeData, removeNode } = useStudio();
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => (r.ok ? r.json() : []))
      .then(setKnowledge)
      .catch(() => setKnowledge([]));
  }, [selectedNodeId]);

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
  const tokenEst = estimateNodeTokens(d);

  const linkedKnowledge = knowledge.filter((k) => d.knowledgeIds?.includes(k.id));

  function toggleKnowledge(id: string) {
    const current = d.knowledgeIds ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    // Merge content from linked items into the node content for execution.
    const merged = knowledge
      .filter((k) => next.includes(k.id))
      .map((k) => `# ${k.title}\n${k.content}`)
      .join("\n\n---\n\n");
    updateNodeData(node.id, { knowledgeIds: next, content: merged });
  }

  function onImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateNodeData(node.id, { imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

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
            {(d.tool === "web-search" || d.tool === "page-reader") && (
              <p className="rounded-md bg-primary/8 p-2 text-[11px] text-primary">
                {d.tool === "page-reader"
                  ? "Feed a URL into this node (e.g. from a trigger) — it extracts clean readable content."
                  : "Uses the upstream text as a search query and returns live results."}
              </p>
            )}
            {d.tool === "http-request" && (
              <div className="space-y-2 rounded-md border border-border p-2.5">
                <div className="flex gap-2">
                  <Select value={d.httpMethod ?? "GET"} onValueChange={(v) => updateNodeData(node.id, { httpMethod: v as "GET" | "POST" })}>
                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={d.httpUrl ?? ""}
                    onChange={(e) => updateNodeData(node.id, { httpUrl: e.target.value })}
                    placeholder="https://api.example.com/data?q={{input}}"
                    className="h-8 text-xs"
                  />
                </div>
                <Textarea
                  value={d.httpHeaders ?? ""}
                  onChange={(e) => updateNodeData(node.id, { httpHeaders: e.target.value })}
                  placeholder='Headers JSON: {"Authorization":"Bearer ..."}'
                  rows={2}
                  className="text-xs font-mono"
                />
                {d.httpMethod === "POST" && (
                  <Textarea
                    value={d.httpBody ?? ""}
                    onChange={(e) => updateNodeData(node.id, { httpBody: e.target.value })}
                    placeholder="POST body (JSON or text)"
                    rows={3}
                    className="text-xs font-mono"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">Use <code className="rounded bg-muted px-1">{"{{input}}"}</code> in the URL to inject upstream text.</p>
              </div>
            )}
            {d.tool === "tts" && (
              <div className="space-y-1.5 rounded-md border border-border p-2.5">
                <Label className="text-xs">Voice</Label>
                <Select value={d.ttsVoice ?? "default"} onValueChange={(v) => updateNodeData(node.id, { ttsVoice: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Converts the upstream text into speech audio.</p>
              </div>
            )}
          </div>
        )}

        {d.kind === "memory" && (
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Memory key</Label>
              <Input
                value={d.memoryKey ?? ""}
                onChange={(e) => updateNodeData(node.id, { memoryKey: e.target.value })}
                placeholder="e.g. user-profile, session-notes"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={d.memoryMode ?? "load"} onValueChange={(v) => updateNodeData(node.id, { memoryMode: v as "save" | "load" | "both" })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="save">Save (write upstream to memory)</SelectItem>
                  <SelectItem value="load">Load (recall stored value)</SelectItem>
                  <SelectItem value="both">Both (save then recall)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              Memory persists across runs on this server. Use it to remember user context, facts, or intermediate results between conversations.
            </p>
          </div>
        )}

        {d.kind === "router" && (
          <div className="space-y-2.5">
            <Label className="text-xs">Routing conditions</Label>
            <p className="text-[11px] text-muted-foreground">If the upstream text contains a keyword, note which branch to take. Connect this node to multiple downstream nodes.</p>
            {(d.routerConditions ?? []).map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={c.keyword}
                  onChange={(e) => {
                    const next = [...(d.routerConditions ?? [])];
                    next[i] = { ...next[i], keyword: e.target.value };
                    updateNodeData(node.id, { routerConditions: next });
                  }}
                  placeholder="keyword"
                  className="h-8 text-xs"
                />
                <Input
                  value={c.targetNodeId}
                  onChange={(e) => {
                    const next = [...(d.routerConditions ?? [])];
                    next[i] = { ...next[i], targetNodeId: e.target.value };
                    updateNodeData(node.id, { routerConditions: next });
                  }}
                  placeholder="→ node id"
                  className="h-8 text-xs"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => updateNodeData(node.id, { routerConditions: (d.routerConditions ?? []).filter((_, j) => j !== i) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1.5"
              onClick={() => updateNodeData(node.id, { routerConditions: [...(d.routerConditions ?? []), { keyword: "", targetNodeId: "" }] })}>
              <Plus className="h-3.5 w-3.5" /> Add condition
            </Button>
          </div>
        )}

        {d.kind === "knowledge" && (
          <div className="space-y-2">
            <Label className="text-xs">Link knowledge items</Label>
            {knowledge.length === 0 ? (
              <p className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                No knowledge items yet. Add some in the Knowledge tab.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto studio-scroll">
                {knowledge.map((k) => {
                  const linked = d.knowledgeIds?.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      onClick={() => toggleKnowledge(k.id)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                        linked ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent"
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${linked ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      <span className="truncate">{k.title}</span>
                      {linked && <Badge variant="default" className="ml-auto h-4 px-1 text-[9px]">linked</Badge>}
                    </button>
                  );
                })}
              </div>
            )}
            <Label className="text-xs pt-1">Or paste raw content</Label>
            <Textarea
              value={d.content ?? ""}
              onChange={(e) => updateNodeData(node.id, { content: e.target.value, knowledgeIds: [] })}
              placeholder="Paste documents, context, or reference text…"
              rows={5}
              className="text-sm"
            />
            {linkedKnowledge.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {linkedKnowledge.length} item{linkedKnowledge.length > 1 ? "s" : ""} linked · {formatTokens(linkedKnowledge.reduce((s, k) => s + k.content.length, 0) / 4)} tokens
              </p>
            )}
          </div>
        )}

        {d.kind === "image-gen" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Image size</Label>
              <Select value={d.imageSize ?? "1024x1024"} onValueChange={(v) => updateNodeData(node.id, { imageSize: v as typeof d.imageSize })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_SIZES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              Connect a trigger or model into this node — its output becomes the image prompt. The generated image is returned to the chat.
            </p>
          </div>
        )}

        {d.kind === "vision" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Attach an image</Label>
              {d.imageUrl ? (
                <div className="relative overflow-hidden rounded-md border border-border">
                  { }
                  <img src={d.imageUrl} alt="attached" className="max-h-40 w-full object-contain bg-muted/30" />
                  <Button
                    size="icon" variant="destructive" className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => updateNodeData(node.id, { imageUrl: undefined })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border p-4 text-center transition-colors hover:border-primary/50 hover:bg-accent">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload an image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Or paste an image URL</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={d.imageUrl?.startsWith("data:") ? "" : (d.imageUrl ?? "")}
                  onChange={(e) => updateNodeData(node.id, { imageUrl: e.target.value })}
                  placeholder="https://…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
            <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
              Uses GLM-4.5V to analyse the attached image. Connect an upstream node for the question, or type one in the trigger.
            </p>
          </div>
        )}

        {d.kind === "output" && (
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            The output node returns the final result of the workflow. Connect a model, tool, image-gen, or vision node into it.
          </p>
        )}

        {/* Token estimate */}
        {tokenEst > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            Est. <span className="font-medium text-foreground">{formatTokens(tokenEst)}</span> tokens / run
          </div>
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
    case "image-gen": return "image";
    case "vision": return "eye";
    case "router": return "git-branch";
    case "memory": return "brain";
    case "output": return "flag";
  }
}
