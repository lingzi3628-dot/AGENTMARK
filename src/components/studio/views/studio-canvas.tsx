"use client";

import { useCallback, useRef, useState } from "react";
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
import { Icon } from "@/components/icon";
import {
  Save, Play, Plus, Workflow, Sparkles, Loader2, PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NODE_PALETTE } from "@/lib/constants";
import type { NodeKind, WorkflowNode, WorkflowNodeData } from "@/lib/types";

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
    activeAgent, nodes, edges, setNodes, setEdges, selectedNodeId,
    setSelectedNode, upsertAgent, setActiveAgent, setView, setGraph,
  } = useStudio();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(activeAgent?.name ?? "Untitled Agent");
  const [saving, setSaving] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const seq = useRef(0);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes(applyNodeChanges(changes, nodes as unknown as Node[]) as unknown as WorkflowNode[]),
    [nodes, setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges(applyEdgeChanges(changes, edges as unknown as Edge[]) as unknown as WorkflowEdge[]),
    [edges, setEdges],
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

  function addNode(kind: NodeKind, position?: { x: number; y: number }) {
    seq.current += 1;
    const id = `${kind}-${Date.now()}-${seq.current}`;
    const defaults: Record<NodeKind, Partial<WorkflowNodeData>> = {
      trigger: { label: "Input", content: "User message" },
      model: { label: "GLM Model", provider: "glm-4.5-air", systemPrompt: "You are a helpful AI agent. Respond clearly and concisely." },
      tool: { label: "Tool", tool: "web-search" },
      knowledge: { label: "Knowledge", content: "" },
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

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/giselle-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/giselle-kind") as NodeKind;
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
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
            className="bg-background studio-grid"
            defaultEdgeOptions={{ animated: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="var(--muted-foreground)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n: Node) => kindColor((n.data as WorkflowNodeData).kind)}
              maskColor="rgb(0 0 0 / 0.6)"
            />
          </ReactFlow>

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
    case "output": return "#f43f5e";
  }
}
