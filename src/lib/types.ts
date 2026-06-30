// Shared domain types for the AGENTMARK AI Agent Studio

export type NodeKind =
  | "trigger" // entry point — user input
  | "model" // LLM generation node
  | "tool" // action / capability (web search, code, etc.)
  | "knowledge" // context / documents
  | "image-gen" // AI image generation
  | "vision" // multimodal image understanding
  | "router" // conditional branching
  | "memory" // conversation memory store
  | "sub-agent" // calls another agent as part of this workflow
  | "code" // run custom JavaScript in a sandbox
  | "approval" // human-in-the-loop pause + review
  | "output"; // final result

export type ModelProvider =
  // AGENTMARK Free (default, no API key)
  | "free-openai"
  | "free-mistral"
  | "free-llama"
  | "free-qwen"
  // GLM models (premium, needs ZAI_API_KEY)
  | "glm-4.6"
  | "glm-4.5"
  | "glm-4.5-air"
  | "glm-4.5v"
  // Custom (user-provided API)
  | "custom"
  | string; // allow arbitrary model IDs for custom providers

export type ToolType =
  | "web-search"
  | "page-reader"
  | "http-request"
  | "summarize"
  | "translate"
  | "code"
  | "classify"
  | "tts";

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
  // router node
  routerConditions?: { keyword: string; targetNodeId: string }[];
  routerDefault?: string; // default target node id
  // http request tool
  httpMethod?: "GET" | "POST";
  httpUrl?: string;
  httpHeaders?: string;
  httpBody?: string;
  // memory node
  memoryKey?: string;
  memoryMode?: "save" | "load" | "both";
  // tts node
  ttsVoice?: string;
  // custom model (when provider === "custom")
  customModelName?: string;
  customApiUrl?: string;
  customApiKey?: string;
  // code node — raw JS function body executed in a vm sandbox
  code?: string;
  // code node — execution timeout in ms (default 5000, max 30000)
  codeTimeout?: number;
  // knowledge node — RAG (semantic search over uploaded Documents)
  useRAG?: boolean;
  ragTopK?: number; // 1-10, default 4
  // sub-agent node — invokes another agent recursively
  subAgentId?: string; // the ID of the agent to invoke
  subAgentInputTemplate?: string; // template for input (default "{{input}}")
  // approval node — pauses the workflow for human review
  approvalMessage?: string; // message shown to the approver
  approvalTimeoutHours?: number; // auto-reject after N hours (default 168 = 7 days)
  approvalNotifyEmail?: boolean; // send email notification (default true)
  status?: "idle" | "running" | "done" | "error";
}

/** RAG document — embedded chunks stored alongside an agent. */
export interface AgentDocument {
  id: string;
  agentId: string;
  title: string;
  content: string; // original text (may be truncated)
  source: string; // URL or filename
  type: "text" | "url" | "markdown" | "pdf";
  chunkCount: number;
  createdAt: string;
}

/** Retrieved chunk returned by /api/agents/[id]/retrieve. */
export interface RetrievedChunk {
  docTitle: string;
  chunk: string;
  score: number;
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

export interface Integration {
  id: string;
  agentId: string;
  platform: string;
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedAgent {
  id: string;
  agentId: string;
  slug: string;
  enabled: boolean;
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

export interface CustomApi {
  id: string;
  label: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  maskedKey: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerConversation {
  id: string;
  title: string;
  business: string;
  audience: string;
  tone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export type StudioView =
  | "dashboard"
  | "studio"
  | "run"
  | "templates"
  | "marketplace"
  | "knowledge"
  | "publish"
  | "integrations"
  | "schedules"
  | "approvals"
  | "optimize"
  | "customer"
  | "analytics"
  | "billing"
  | "api-keys"
  | "teams"
  | "history"
  | "settings";

export interface TemplateShare {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  authorId: string;
  authorName: string;
  authorAvatar: string;
  installs: number;
  rating: number;
  ratingCount: number;
  priceCents: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Human-in-the-loop approval row (mirrors the Approval Prisma model). */
export interface Approval {
  id: string;
  agentId: string;
  runId: string;
  nodeId: string;
  context: string;
  status: "pending" | "approved" | "rejected" | "expired";
  decidedById: string | null;
  decidedAt: string | null;
  comment: string;
  expiresAt: string | null;
  createdAt: string;
  // Joined fields surfaced by the API for display:
  agentName?: string;
  nodeLabel?: string;
  approvalMessage?: string;
}

/** One AI-generated suggestion from the workflow optimizer. */
export interface OptimizeSuggestion {
  type: "cost" | "latency" | "reliability" | "best-practice";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  nodeId?: string;
  estimatedSavings?: string;
}

/** Full response from POST /api/agents/[id]/optimize. */
export interface OptimizeResponse {
  suggestions: OptimizeSuggestion[];
  overallScore: number;
  summary: string;
}
