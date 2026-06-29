import type { ModelProvider, ToolType, Template, WorkflowNode, WorkflowEdge } from "./types";

export interface ModelDef {
  id: ModelProvider;
  name: string;
  label: string;
  description: string;
  contextWindow: string;
  badge?: string;
}

export const MODELS: ModelDef[] = [
  {
    id: "glm-4.6",
    name: "GLM-4.6",
    label: "Flagship reasoning",
    description: "Most capable model for complex agentic reasoning and tool use.",
    contextWindow: "200K",
    badge: "Flagship",
  },
  {
    id: "glm-4.5",
    name: "GLM-4.5",
    label: "Balanced",
    description: "Strong general-purpose model with fast, reliable responses.",
    contextWindow: "128K",
  },
  {
    id: "glm-4.5-air",
    name: "GLM-4.5 Air",
    label: "Fast & light",
    description: "Optimized for speed and cost — great for high-volume tasks.",
    contextWindow: "128K",
    badge: "Fast",
  },
  {
    id: "glm-4.5v",
    name: "GLM-4.5V",
    label: "Vision",
    description: "Multimodal model that understands images alongside text.",
    contextWindow: "64K",
    badge: "Vision",
  },
];

export interface ToolDef {
  id: ToolType;
  name: string;
  description: string;
  icon: string;
}

export const TOOLS: ToolDef[] = [
  { id: "web-search", name: "Web Search", description: "Retrieve live information from the web.", icon: "globe" },
  { id: "summarize", name: "Summarize", description: "Condense long content into concise summaries.", icon: "file-text" },
  { id: "translate", name: "Translate", description: "Translate text between languages.", icon: "languages" },
  { id: "code", name: "Code Generator", description: "Generate, explain, and refactor code.", icon: "code" },
  { id: "classify", name: "Classifier", description: "Categorize inputs into defined labels.", icon: "tags" },
];

export const NODE_PALETTE = [
  { kind: "trigger", label: "Trigger", icon: "play", desc: "Starts the workflow with user input" },
  { kind: "model", label: "Language Model", icon: "sparkles", desc: "Generates text with an LLM" },
  { kind: "tool", label: "Tool", icon: "wrench", desc: "Runs an action like search or summarize" },
  { kind: "knowledge", label: "Knowledge", icon: "database", desc: "Injects documents as context" },
  { kind: "output", label: "Output", icon: "flag", desc: "Returns the final result" },
] as const;

export const AGENT_ICONS = [
  "sparkles", "bot", "brain", "code", "pen-tool", "search", "file-text",
  "languages", "database", "rocket", "lightbulb", "wand-2",
];

export const CATEGORIES = [
  "custom", "productivity", "engineering", "research", "content", "support",
];

// --- Default templates (node graphs) ---

let _id = 0;
const nid = (p: string) => `${p}-${++_id}`;

function node(
  id: string,
  kind: WorkflowNode["data"]["kind"],
  position: { x: number; y: number },
  extra: Partial<WorkflowNode["data"]> = {},
): WorkflowNode {
  return { id, type: "agent", position, data: { label: "", kind, ...extra } };
}

function edge(source: string, target: string): WorkflowEdge {
  return { id: `e-${source}-${target}`, source, target, animated: true };
}

export const DEFAULT_TEMPLATES: Omit<Template, "id" | "createdAt" | "installs">[] = [
  {
    name: "Research Assistant",
    description: "Searches the web, synthesizes findings, and writes a structured brief.",
    icon: "search",
    category: "research",
    tags: ["research", "web-search", "summary"],
    featured: true,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Question", content: "User question" }),
      node("m1", "model", { x: 320, y: 80 }, { label: "Plan", provider: "glm-4.6", systemPrompt: "Break the question into sub-questions to research." }),
      node("tl1", "tool", { x: 320, y: 320 }, { label: "Web Search", tool: "web-search" }),
      node("m2", "model", { x: 640, y: 200 }, { label: "Synthesize", provider: "glm-4.6", systemPrompt: "Write a clear, well-structured research brief with citations." }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Brief" }),
    ],
    edges: [
      edge("t1", "m1"), edge("t1", "tl1"),
      edge("m1", "m2"), edge("tl1", "m2"),
      edge("m2", "o1"),
    ],
  },
  {
    name: "AI Code Reviewer",
    description: "Reviews a diff, finds bugs, and suggests improvements with severity.",
    icon: "code",
    category: "engineering",
    tags: ["code", "review", "engineering"],
    featured: true,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Diff / Code", content: "Paste a diff or code snippet" }),
      node("m1", "model", { x: 340, y: 200 }, { label: "Review", provider: "glm-4.6", systemPrompt: "You are a senior engineer. Review the code for bugs, security, and style. Rate severity (low/med/high) per finding." }),
      node("o1", "output", { x: 680, y: 200 }, { label: "Review Report" }),
    ],
    edges: [edge("t1", "m1"), edge("m1", "o1")],
  },
  {
    name: "Document Summarizer",
    description: "Condenses long documents into executive summaries and key points.",
    icon: "file-text",
    category: "content",
    tags: ["summary", "documents"],
    featured: false,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Document", content: "Long-form text" }),
      node("k1", "knowledge", { x: 320, y: 80 }, { label: "Style Guide", content: "Tone: professional, concise." }),
      node("tl1", "tool", { x: 320, y: 320 }, { label: "Summarize", tool: "summarize" }),
      node("m1", "model", { x: 640, y: 200 }, { label: "Polish", provider: "glm-4.5-air", systemPrompt: "Produce an executive summary + 5 key bullet points." }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Summary" }),
    ],
    edges: [edge("t1", "tl1"), edge("k1", "m1"), edge("tl1", "m1"), edge("m1", "o1")],
  },
  {
    name: "PRD Generator",
    description: "Turns a one-line idea into a structured product requirements doc.",
    icon: "pen-tool",
    category: "productivity",
    tags: ["writing", "product", "prm"],
    featured: true,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Idea", content: "A one-line product idea" }),
      node("m1", "model", { x: 340, y: 200 }, { label: "Draft PRD", provider: "glm-4.6", systemPrompt: "Write a complete PRD: problem, goals, users, requirements, success metrics, risks, milestones." }),
      node("o1", "output", { x: 680, y: 200 }, { label: "PRD" }),
    ],
    edges: [edge("t1", "m1"), edge("m1", "o1")],
  },
  {
    name: "Support Triage",
    description: "Classifies incoming tickets and drafts a first response.",
    icon: "bot",
    category: "support",
    tags: ["support", "classify", "automation"],
    featured: false,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Ticket", content: "Customer message" }),
      node("tl1", "tool", { x: 320, y: 320 }, { label: "Classify", tool: "classify" }),
      node("m1", "model", { x: 320, y: 80 }, { label: "Draft Reply", provider: "glm-4.5", systemPrompt: "Draft an empathetic, helpful first response." }),
      node("m2", "model", { x: 640, y: 200 }, { label: "Merge", provider: "glm-4.5-air", systemPrompt: "Combine the classification and draft into a single response." }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Response" }),
    ],
    edges: [edge("t1", "tl1"), edge("t1", "m1"), edge("m1", "m2"), edge("tl1", "m2"), edge("m2", "o1")],
  },
  {
    name: "Translator Pro",
    description: "Translates text and adapts tone for the target locale.",
    icon: "languages",
    category: "content",
    tags: ["translate", "localization"],
    featured: false,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Source Text", content: "Text to translate" }),
      node("tl1", "tool", { x: 340, y: 200 }, { label: "Translate", tool: "translate" }),
      node("m1", "model", { x: 680, y: 200 }, { label: "Adapt Tone", provider: "glm-4.5-air", systemPrompt: "Adapt the translation to sound natural and culturally appropriate." }),
      node("o1", "output", { x: 1020, y: 200 }, { label: "Translation" }),
    ],
    edges: [edge("t1", "tl1"), edge("tl1", "m1"), edge("m1", "o1")],
  },
];
