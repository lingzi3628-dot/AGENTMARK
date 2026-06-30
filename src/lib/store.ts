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

// Max number of undo snapshots we keep per agent session.
const HISTORY_CAP = 50;
// Debounce window for collapsing rapid updateNodeData calls (e.g. typing in
// the inspector) into a single history entry.
const UPDATE_DEBOUNCE_MS = 500;

// Module-level state for the debounced history push used by updateNodeData.
// We capture the *pre-batch* node/edge state on the first update in a burst,
// then commit it to history once the user pauses. This avoids creating one
// history entry per keystroke while still preserving the pre-edit snapshot.
let updateSnapshot: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null = null;
let updateTimer: ReturnType<typeof setTimeout> | null = null;

// Discard any pending debounced history push. Called whenever the undo/redo
// stack is touched explicitly (undo, redo, pushHistory, clearHistory) so a
// stale pre-batch snapshot can't be resurrected onto a different state.
function discardPendingUpdate(): void {
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  updateSnapshot = null;
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
  // true when the user explicitly requested a fresh blank canvas (New Agent)
  newAgentRequested: boolean;
  setNewAgentRequested: (v: boolean) => void;

  // editor graph (working copy)
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setGraph: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  setNodes: (n: WorkflowNode[]) => void;
  setEdges: (e: WorkflowEdge[]) => void;
  // Silent variants — they mutate state WITHOUT pushing to the undo stack.
  // Use these for live drag/position updates driven by React Flow's
  // onNodesChange; pair with pushHistory() on drag start instead.
  setNodesSilent: (n: WorkflowNode[]) => void;
  setEdgesSilent: (e: WorkflowEdge[]) => void;
  onNodesChange: (n: WorkflowNode[]) => void;
  onEdgesChange: (e: WorkflowEdge[]) => void;
  addNode: (n: WorkflowNode) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNode["data"]>) => void;
  removeNode: (id: string) => void;

  // undo / redo
  history: WorkflowNode[][];
  future: WorkflowNode[][];
  historyEdges: WorkflowEdge[][];
  futureEdges: WorkflowEdge[][];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

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
  newAgentRequested: false,
  setNewAgentRequested: (v) => set({ newAgentRequested: v }),
  setActiveAgent: (a) =>
    set({
      activeAgent: a,
      activeAgentId: a?.id ?? null,
      nodes: a?.nodes ?? [],
      edges: a?.edges ?? [],
      selectedNodeId: null,
      messages: [],
      runTrace: [],
      newAgentRequested: a ? false : useStudio.getState().newAgentRequested,
      // Switching agents crosses a boundary — wipe history so undo doesn't
      // resurrect another agent's nodes onto this canvas.
      history: [],
      future: [],
      historyEdges: [],
      futureEdges: [],
    }),

  nodes: [],
  edges: [],
  setGraph: (nodes, edges) =>
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
      nodes,
      edges,
    })),
  setNodes: (n) =>
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
      nodes: n,
    })),
  setEdges: (e) =>
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
      edges: e,
    })),
  setNodesSilent: (n) => set({ nodes: n }),
  setEdgesSilent: (e) => set({ edges: e }),
  onNodesChange: (n) => set({ nodes: n }),
  onEdgesChange: (e) => set({ edges: e }),
  addNode: (n) =>
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
      nodes: [...s.nodes, n],
    })),
  updateNodeData: (id, data) =>
    set((s) => {
      // Capture the pre-batch state once per typing burst so undo restores
      // the value the user saw before they started editing.
      if (!updateSnapshot) {
        updateSnapshot = { nodes: s.nodes, edges: s.edges };
      }
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        const snap = updateSnapshot;
        updateSnapshot = null;
        updateTimer = null;
        if (!snap) return;
        useStudio.setState((prev) => ({
          history: [...prev.history, snap.nodes].slice(-HISTORY_CAP),
          historyEdges: [...prev.historyEdges, snap.edges].slice(-HISTORY_CAP),
          future: [],
          futureEdges: [],
        }));
      }, UPDATE_DEBOUNCE_MS);

      return {
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      };
    }),
  removeNode: (id) =>
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  history: [],
  future: [],
  historyEdges: [],
  futureEdges: [],
  pushHistory: () => {
    discardPendingUpdate();
    set((s) => ({
      history: [...s.history, s.nodes].slice(-HISTORY_CAP),
      historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      future: [],
      futureEdges: [],
    }));
  },
  undo: () => {
    discardPendingUpdate();
    set((s) => {
      if (s.history.length === 0) return s;
      const prevNodes = s.history[s.history.length - 1];
      const prevEdges = s.historyEdges[s.historyEdges.length - 1];
      return {
        nodes: prevNodes,
        edges: prevEdges,
        history: s.history.slice(0, -1),
        historyEdges: s.historyEdges.slice(0, -1),
        future: [...s.future, s.nodes].slice(-HISTORY_CAP),
        futureEdges: [...s.futureEdges, s.edges].slice(-HISTORY_CAP),
      };
    });
  },
  redo: () => {
    discardPendingUpdate();
    set((s) => {
      if (s.future.length === 0) return s;
      const nextNodes = s.future[s.future.length - 1];
      const nextEdges = s.futureEdges[s.futureEdges.length - 1];
      return {
        nodes: nextNodes,
        edges: nextEdges,
        future: s.future.slice(0, -1),
        futureEdges: s.futureEdges.slice(0, -1),
        history: [...s.history, s.nodes].slice(-HISTORY_CAP),
        historyEdges: [...s.historyEdges, s.edges].slice(-HISTORY_CAP),
      };
    });
  },
  canUndo: () => useStudio.getState().history.length > 0,
  canRedo: () => useStudio.getState().future.length > 0,
  clearHistory: () => {
    discardPendingUpdate();
    set({ history: [], future: [], historyEdges: [], futureEdges: [] });
  },

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
