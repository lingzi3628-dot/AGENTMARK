"use client";

import { create } from "zustand";
import type {
  Agent,
  StudioView,
  WorkflowNode,
  WorkflowEdge,
  RunRecord,
} from "./types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  trace?: { node: string; label: string; status: string }[];
}

interface StudioState {
  // navigation
  view: StudioView;
  setView: (v: StudioView) => void;

  // agents
  agents: Agent[];
  setAgents: (a: Agent[]) => void;
  upsertAgent: (a: Agent) => void;
  removeAgent: (id: string) => void;

  // currently edited agent
  activeAgentId: string | null;
  activeAgent: Agent | null;
  setActiveAgent: (a: Agent | null) => void;

  // editor graph (working copy)
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setGraph: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setNodes: (n: WorkflowNode[]) => void;
  setEdges: (e: WorkflowEdge[]) => void;
  onNodesChange: (n: WorkflowNode[]) => void;
  onEdgesChange: (e: WorkflowEdge[]) => void;
  addNode: (n: WorkflowNode) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNode["data"]>) => void;
  removeNode: (id: string) => void;

  // selected node (for inspector panel)
  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;

  // run / chat
  messages: ChatMessage[];
  isRunning: boolean;
  runTrace: { node: string; label: string; status: string }[];
  setMessages: (m: ChatMessage[]) => void;
  addMessage: (m: ChatMessage) => void;
  appendToMessage: (id: string, chunk: string) => void;
  finalizeMessage: (id: string) => void;
  setRunning: (r: boolean) => void;
  setRunTrace: (t: { node: string; label: string; status: string }[]) => void;

  // run history
  runs: RunRecord[];
  setRuns: (r: RunRecord[]) => void;
  addRun: (r: RunRecord) => void;

  // theme
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;

  // mobile sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
}

export const useStudio = create<StudioState>((set) => ({
  view: "dashboard",
  setView: (v) => set({ view: v }),

  agents: [],
  setAgents: (a) => set({ agents: a }),
  upsertAgent: (a) =>
    set((s) => {
      const exists = s.agents.find((x) => x.id === a.id);
      return {
        agents: exists
          ? s.agents.map((x) => (x.id === a.id ? a : x))
          : [a, ...s.agents],
      };
    }),
  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((x) => x.id !== id),
      activeAgentId: s.activeAgentId === id ? null : s.activeAgentId,
      activeAgent: s.activeAgentId === id ? null : s.activeAgent,
    })),

  activeAgentId: null,
  activeAgent: null,
  setActiveAgent: (a) =>
    set({
      activeAgent: a,
      activeAgentId: a?.id ?? null,
      nodes: a?.nodes ?? [],
      edges: a?.edges ?? [],
      selectedNodeId: null,
      messages: [],
      runTrace: [],
    }),

  nodes: [],
  edges: [],
  setGraph: (nodes, edges) => set({ nodes, edges }),
  setNodes: (n) => set({ nodes: n }),
  setEdges: (e) => set({ edges: e }),
  onNodesChange: (n) => set({ nodes: n }),
  onEdgesChange: (e) => set({ edges: e }),
  addNode: (n) => set((s) => ({ nodes: [...s.nodes, n] })),
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  messages: [],
  isRunning: false,
  runTrace: [],
  setMessages: (m) => set({ messages: m }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendToMessage: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m,
      ),
    })),
  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false } : m,
      ),
    })),
  setRunning: (r) => set({ isRunning: r }),
  setRunTrace: (t) => set({ runTrace: t }),

  runs: [],
  setRuns: (r) => set({ runs: r }),
  addRun: (r) => set((s) => ({ runs: [r, ...s.runs].slice(0, 50) })),

  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setTheme: (t) => set({ theme: t }),

  sidebarOpen: false,
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
}));
