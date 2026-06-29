// Shared domain types for the Giselle-inspired AI Agent Studio

export type NodeKind =
  | "trigger" // entry point — user input
  | "model" // LLM generation node
  | "tool" // action / capability (web search, code, etc.)
  | "knowledge" // context / documents
  | "image-gen" // AI image generation
  | "vision" // multimodal image understanding
  | "output"; // final result

export type ModelProvider = "glm-4.6" | "glm-4.5" | "glm-4.5-air" | "glm-4.5v";

export type ToolType =
  | "web-search"
  | "page-reader"
  | "summarize"
  | "translate"
  | "code"
  | "classify";

export interface WorkflowNodeData {
  label: string;
  kind: NodeKind;
  provider?: ModelProvider;
  systemPrompt?: string;
  temperature?: number;
  tool?: ToolType;
  knowledgeIds?: string[];
  content?: string;
  imageUrl?: string; // for vision node (base64 or data URL)
  imageSize?: "1024x1024" | "768x1344" | "864x1152" | "1344x768" | "1152x864";
  status?: "idle" | "running" | "done" | "error";
}

// React Flow compatible node
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  agentId: string;
  input: string;
  output: string;
  status: "running" | "completed" | "error";
  tokens: number;
  duration: number;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  agentId: string | null;
  title: string;
  content: string;
  type: "text" | "file" | "url";
  source: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  featured: boolean;
  installs: number;
  createdAt: string;
}

export type StudioView = "dashboard" | "studio" | "run" | "templates" | "knowledge";
