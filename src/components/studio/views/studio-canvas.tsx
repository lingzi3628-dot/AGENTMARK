"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges,
  useReactFlow, type NodeChange, type EdgeChange, type Connection, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStudio } from "@/lib/store";
import { AgentNode } from "@/components/studio/nodes/agent-node";
import { InspectorPanel } from "@/components/studio/inspector-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import {
  Save, Play, Plus, Workflow, Sparkles, Loader2, PanelLeft,
  Undo2, Redo2, Copy, ClipboardPaste, Trash2,
  Maximize2, Download, LayoutGrid, MapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NODE_PALETTE } from "@/lib/constants";
import { copyNode, pasteNode, hasCopiedNode } from "@/lib/node-clipboard";
import type { NodeKind, WorkflowNode, WorkflowNodeData, WorkflowEdge } from "@/lib/types";

const nodeTypes = { agent: AgentNode };

export function StudioCanvas() {
  return (
    <ReactFlowProvider>
      <StudioInner />
    </ReactFlowProvider>
  );
}

function StudioInner() {
  const {
    activeAgent, agents, nodes, edges,
    setNodes, setEdges, setNodesSilent, setEdgesSilent,
    selectedNodeId, setSelectedNode, upsertAgent, setActiveAgent,
    setView, setGraph, removeNode, pushHistory, undo, redo,
    newAgentRequested,
  } = useStudio();
  // Subscribe to history length so the toolbar buttons re-render reactively
  // when the undo/redo stacks change.
  const historyLen = useStudio((s) => s.history.length);
  const futureLen = useStudio((s) => s.future.length);

  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(activeAgent?.name ?? "Untitled Agent");
  const [saving, setSaving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [rfInstance, setRfInstance] = useState<import("@xyflow/react").ReactFlowInstance | null>(null);
  // Tracks whether there's a node in the in-memory clipboard so the Paste
  // button can enable/disable. Bumped on every copy.
  const [clipboardVersion, setClipboardVersion] = useState(0);
  const seq = useRef(0);

  // Auto-layout: arrange nodes in a left-to-right flow based on topological order
  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();
    // Simple layout: sort by edges (upstream first), then stagger vertically
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of nodes) { indeg.set(n.id, 0); adj.set(n.id, []); }
    for (const e of edges) {
      if (!indeg.has(e.target)) indeg.set(e.target, 0);
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const levels = new Map<string, number>();
    let current = queue;
    let level = 0;
    while (current.length > 0) {
      const next: string[] = [];
      for (const id of current) {
        levels.set(id, level);
        for (const target of adj.get(id) ?? []) {
          indeg.set(target, (indeg.get(target) ?? 1) - 1);
          if ((indeg.get(target) ?? 0) === 0) next.push(target);
        }
      }
      current = next;
      level++;
    }
    // Assign positions by level
    const byLevel = new Map<number, typeof nodes>();
    for (const n of nodes) {
      const lv = levels.get(n.id) ?? 0;
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv)!.push(n);
    }
    const newNodes = [...nodes];
    for (const [lv, lvNodes] of byLevel) {
      lvNodes.forEach((n, i) => {
        const idx = newNodes.findIndex((x) => x.id === n.id);
        if (idx >= 0) {
          newNodes[idx] = {
            ...n,
            position: { x: 80 + lv * 320, y: 120 + i * 140 },
          };
        }
      });
    }
    setNodesSilent(newNodes);
    toast.success("Layout applied");
    setTimeout(() => rfInstance?.fitView({ padding: 0.25, duration: 300 }), 100);
  }, [nodes, edges, pushHistory, setNodesSilent, rfInstance]);

  const toggleMiniMap = useCallback(() => {
    setShowMiniMap((v) => !v);
  }, []);

  const exportCanvasPng = useCallback(() => {
    if (!rfInstance) {
      toast.error("Canvas not ready");
      return;
    }
    // Use React Flow's built-in toObject + html-to-image approach
    // Since we don't have html-to-image installed, use a simpler approach:
    // Open a new window with the canvas SVG
    const data = rfInstance.toObject();
    const width = 1200;
    const height = 700;
    const svgNodes = data.nodes.map((n: { id: string; position: { x: number; y: number }; data: { label?: string; kind?: string } }) => {
      const x = n.position.x + 50;
      const y = n.position.y + 30;
      const label = n.data?.label || n.id;
      return `<g transform="translate(${n.position.x},${n.position.y})">
        <rect width="200" height="60" rx="8" fill="#1a1a2e" stroke="#34d399" stroke-width="2"/>
        <text x="100" y="35" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="13" font-weight="500">${label}</text>
      </g>`;
    }).join("\n");
    const svgEdges = data.edges.map((e: { source: string; target: string }) => {
      const s = data.nodes.find((n: { id: string }) => n.id === e.source);
      const t = data.nodes.find((n: { id: string }) => n.id === e.target);
      if (!s || !t) return "";
      const x1 = s.position.x + 200, y1 = s.position.y + 30;
      const x2 = t.position.x, y2 = t.position.y + 30;
      return `<path d="M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}" stroke="#34d399" stroke-width="2" fill="none" marker-end="url(#arrow)"/>`;
    }).join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#0f1419">
      <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#34d399"/></marker></defs>
      ${svgEdges}${svgNodes}
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "agentmark-canvas"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Canvas exported as SVG");
  }, [rfInstance, name]);

  // Auto-load the most recent agent if none is active (unless the user just
  // clicked "New Agent"), so the canvas isn't empty on first visit.
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  useEffect(() => {
    if (!activeAgent && !newAgentRequested && agentsRef.current.length > 0) {
      setActiveAgent(agentsRef.current[0]);
    }
  }, [activeAgent, newAgentRequested, setActiveAgent]);

  // Keep the name field in sync when the active agent changes.
  useEffect(() => {
    setName(activeAgent?.name ?? "Untitled Agent");
  }, [activeAgent?.id]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes as unknown as Node[]) as unknown as WorkflowNode[];
      // "remove" changes (ReactFlow's built-in delete) should be undoable;
      // pure position/select/dimension changes are silent so we don't pollute
      // the stack on every drag tick.
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) setNodes(next);
      else setNodesSilent(next);
    },
    [nodes, setNodes, setNodesSilent],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, edges as unknown as Edge[]) as unknown as WorkflowEdge[];
      const hasRemove = changes.some((c) => c.type === "remove");
      if (hasRemove) setEdges(next);
      else setEdgesSilent(next);
    },
    [edges, setEdges, setEdgesSilent],
  );
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges(
        addEdge(
          { ...c, animated: true, id: `e-${c.source}-${c.target}-${Date.now()}` },
          edges as unknown as Edge[],
        ) as unknown as WorkflowEdge[],
      ),
    [edges, setEdges],
  );

  // Capture the pre-drag state into history when the user starts dragging a
  // node. onNodesChange fires silently during the drag itself.
  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  function addNode(kind: NodeKind, position?: { x: number; y: number }) {
    seq.current += 1;
    const id = `${kind}-${Date.now()}-${seq.current}`;
    const defaults: Record<NodeKind, Partial<WorkflowNodeData>> = {
      trigger: { label: "Input", content: "User message" },
      model: { label: "AI Model", provider: "free-openai", systemPrompt: "You are a helpful AI agent. Respond clearly and concisely." },
      tool: { label: "Tool", tool: "web-search" },
      knowledge: { label: "Knowledge", content: "" },
      "image-gen": { label: "Image Gen", imageSize: "1024x1024" },
      vision: { label: "Vision", imageUrl: undefined },
      router: { label: "Router", routerConditions: [], routerDefault: "" },
      memory: { label: "Memory", memoryKey: "default", memoryMode: "load" },
      "sub-agent": { label: "Sub-Agent", subAgentId: "", subAgentInputTemplate: "{{input}}" },
      code: { label: "Code", code: "", codeTimeout: 5000 },
      output: { label: "Output" },
    };
    const pos = position ?? { x: 120 + Math.random() * 80, y: 160 + Math.random() * 120 };
    const node: WorkflowNode = {
      id, type: "agent", position: pos,
      data: { kind, status: "idle", ...defaults[kind] } as WorkflowNodeData,
    };
    setNodes([...nodes, node]);
    setSelectedNode(id);
  }

  function copySelected() {
    if (!selectedNodeId) {
      toast.error("Select a node to copy first");
      return;
    }
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    copyNode(node);
    setClipboardVersion((v) => v + 1);
    toast.success("Node copied");
  }

  function pasteFromClipboard() {
    const copied = pasteNode();
    if (!copied) {
      toast.error("Nothing to paste — copy a node first");
      return;
    }
    seq.current += 1;
    const newNode: WorkflowNode = {
      ...copied,
      id: `${copied.data.kind}-${Date.now()}-${seq.current}`,
      position: { x: copied.position.x + 50, y: copied.position.y + 50 },
      // pasteNode already returns a deep copy of data, but make sure we don't
      // share the same object reference between the original and the paste.
      data: { ...copied.data },
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode.id);
    toast.success("Node pasted");
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
  }

  // Global keyboard shortcuts: undo/redo, copy/paste, delete, escape.
  // Bind once and read fresh state from the store inside the handler so we
  // don't have to re-bind on every keystroke.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
      const mod = e.metaKey || e.ctrlKey;

      // Undo: Cmd/Ctrl+Z
      if (mod && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        if (inEditable) return; // let the browser undo typing
        e.preventDefault();
        const s = useStudio.getState();
        if (s.history.length === 0) return;
        s.undo();
        return;
      }
      // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
      if ((mod && e.shiftKey && (e.key === "z" || e.key === "Z")) || (mod && (e.key === "y" || e.key === "Y"))) {
        if (inEditable) return;
        e.preventDefault();
        const s = useStudio.getState();
        if (s.future.length === 0) return;
        s.redo();
        return;
      }
      // Copy: Cmd/Ctrl+C
      if (mod && (e.key === "c" || e.key === "C")) {
        if (inEditable) return; // let the browser copy selected text
        const s = useStudio.getState();
        if (!s.selectedNodeId) return;
        const node = s.nodes.find((n) => n.id === s.selectedNodeId);
        if (!node) return;
        e.preventDefault();
        copyNode(node);
        setClipboardVersion((v) => v + 1);
        toast.success("Node copied");
        return;
      }
      // Paste: Cmd/Ctrl+V
      if (mod && (e.key === "v" || e.key === "V")) {
        if (inEditable) return; // let the browser paste
        const copied = pasteNode();
        if (!copied) return;
        e.preventDefault();
        const s = useStudio.getState();
        const seqVal = ++seq.current;
        const newNode: WorkflowNode = {
          ...copied,
          id: `${copied.data.kind}-${Date.now()}-${seqVal}`,
          position: { x: copied.position.x + 50, y: copied.position.y + 50 },
          data: { ...copied.data },
        };
        s.setNodes([...s.nodes, newNode]);
        s.setSelectedNode(newNode.id);
        toast.success("Node pasted");
        return;
      }
      // Delete / Backspace: remove selected node
      if ((e.key === "Delete" || e.key === "Backspace") && !inEditable) {
        const s = useStudio.getState();
        if (!s.selectedNodeId) return;
        e.preventDefault();
        s.removeNode(s.selectedNodeId);
        return;
      }
      // Escape: deselect
      if (e.key === "Escape") {
        const s = useStudio.getState();
        if (s.selectedNodeId) {
          s.setSelectedNode(null);
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/agentmark-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/agentmark-kind") as NodeKind;
    if (!kind) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(kind, position);
  };

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || "Untitled Agent",
        description: activeAgent?.description ?? "",
        icon: activeAgent?.icon ?? "sparkles",
        category: activeAgent?.category ?? "custom",
        nodes, edges,
      };
      if (activeAgent) {
        const res = await fetch(`/api/agents/${activeAgent.id}`, {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = (await res.json()) as typeof activeAgent;
        upsertAgent(updated);
        setActiveAgent(updated);
        toast.success("Agent saved");
      } else {
        const res = await fetch("/api/agents", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = (await res.json()) as typeof activeAgent;
        upsertAgent(created);
        setActiveAgent(created);
        toast.success("Agent created", { description: "Saved to your workspace." });
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function run() {
    if (nodes.length === 0) {
      toast.error("Add at least one node before running");
      return;
    }
    if (!activeAgent) {
      // persist first, then run
      save().then(() => setView("run"));
    } else {
      setView("run");
    }
  }

  const canUndo = historyLen > 0;
  const canRedo = futureLen > 0;
  const hasSelected = !!selectedNodeId;
  // Touch clipboardVersion so the linter doesn't complain and so we re-read
  // the module state on every render where this matters.
  const hasClip = clipboardVersion >= 0 && hasCopiedNode();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/60 px-3 backdrop-blur">
        <Button
          variant="ghost" size="icon" className="h-9 w-9 lg:hidden"
          onClick={() => setPaletteOpen((v) => !v)} aria-label="Toggle node palette"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 max-w-xs border-transparent bg-transparent px-2 text-sm font-semibold focus-visible:border-input focus-visible:bg-background"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Workflow className="h-3.5 w-3.5" /> {nodes.length} nodes
          </span>
          <Button variant="outline" size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button size="sm" onClick={run} className="gap-1.5">
            <Play className="h-4 w-4" /> Run
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside
          className={cn(
            "flex w-56 shrink-0 flex-col gap-2 border-r border-border bg-card/40 p-3 overflow-y-auto studio-scroll",
            "max-lg:absolute max-lg:inset-y-0 max-lg:left-16 max-lg:top-14 max-lg:z-30 max-lg:shadow-xl max-lg:transition-transform",
            paletteOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          )}
        >
          <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Add node
          </div>
          {NODE_PALETTE.map((p) => (
            <div
              key={p.kind}
              draggable
              onDragStart={(e) => onDragStart(e, p.kind)}
              onDoubleClick={() => addNode(p.kind)}
              className="group flex cursor-grab items-start gap-2.5 rounded-lg border border-border bg-background p-2.5 transition-all hover:border-primary/50 hover:shadow-sm active:cursor-grabbing"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                <Icon name={p.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight">{p.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{p.desc}</div>
              </div>
            </div>
          ))}
          <div className="mt-auto rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            <Sparkles className="mb-1 h-3.5 w-3.5 text-primary" />
            Drag onto the canvas, or double-click to add. Connect handles to link nodes.
          </div>
        </aside>

        {/* Canvas */}
        <div ref={wrapperRef} className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedNode(n.id)}
            onPaneClick={() => setSelectedNode(null)}
            onNodeDragStart={onNodeDragStart}
            onInit={setRfInstance}
            // Disable ReactFlow's built-in Backspace-to-delete so our global
            // handler owns the delete semantics (and respects input focus).
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            className="bg-background studio-grid"
            defaultEdgeOptions={{ animated: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--muted-foreground)" />
            <Controls showInteractive={false} />
            {showMiniMap && (
              <MiniMap
                pannable
                zoomable
                nodeColor={(n: Node) => kindColor((n.data as WorkflowNodeData).kind)}
                maskColor="rgb(0 0 0 / 0.6)"
              />
            )}
          </ReactFlow>

          {/* Floating edit toolbar — undo/redo/copy/paste/delete + canvas actions */}
          <div className="absolute left-3 top-3 z-10">
            <Card className="flex-row gap-0.5 rounded-lg p-1 shadow-md">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={undo} disabled={!canUndo}
                title="Undo (Cmd/Ctrl+Z)" aria-label="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={redo} disabled={!canRedo}
                title="Redo (Cmd/Ctrl+Shift+Z)" aria-label="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="my-1 w-px self-stretch bg-border" aria-hidden />
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={copySelected} disabled={!hasSelected}
                title="Copy selected node (Cmd/Ctrl+C)" aria-label="Copy node"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={pasteFromClipboard} disabled={!hasClip}
                title="Paste node (Cmd/Ctrl+V)" aria-label="Paste node"
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={deleteSelected} disabled={!hasSelected}
                title="Delete selected node (Delete)" aria-label="Delete node"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="my-1 w-px self-stretch bg-border" aria-hidden />
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => rfInstance?.fitView({ padding: 0.25, duration: 300 })}
                title="Fit to view" aria-label="Fit to view"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={autoLayout}
                title="Auto-layout (arrange nodes neatly)" aria-label="Auto-layout"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={toggleMiniMap}
                title="Toggle mini-map" aria-label="Toggle mini-map"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={exportCanvasPng}
                title="Export canvas as PNG" aria-label="Export PNG"
              >
                <Download className="h-4 w-4" />
              </Button>
            </Card>
          </div>

          {/* Empty hint */}
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/80 p-8 text-center backdrop-blur">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Workflow className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-semibold">Start building your agent</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Drag a node from the left, or double-click one to add it to the canvas.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addNode("trigger")}>
                  <Plus className="h-4 w-4" /> Add a trigger
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        {selectedNodeId && (
          <div className="absolute inset-y-0 right-0 z-20 max-lg:bg-background/40 max-lg:backdrop-blur-sm">
            <InspectorPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function kindColor(kind: NodeKind): string {
  switch (kind) {
    case "trigger": return "#10b981";
    case "model": return "var(--primary)";
    case "tool": return "#f59e0b";
    case "knowledge": return "#8b5cf6";
    case "image-gen": return "#ec4899";
    case "vision": return "#06b6d4";
    case "router": return "#f97316";
    case "memory": return "#14b8a6";
    case "sub-agent": return "#8b5cf6";
    case "code": return "#f59e0b";
    case "output": return "#f43f5e";
    default: return "var(--primary)";
  }
}
