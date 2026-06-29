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
  { id: "page-reader", name: "Page Reader", description: "Fetch and extract clean content from a URL.", icon: "link" },
  { id: "http-request", name: "HTTP Request", description: "Call any REST API with GET or POST.", icon: "webhook" },
  { id: "summarize", name: "Summarize", description: "Condense long content into concise summaries.", icon: "file-text" },
  { id: "translate", name: "Translate", description: "Translate text between languages.", icon: "languages" },
  { id: "code", name: "Code Generator", description: "Generate, explain, and refactor code.", icon: "code" },
  { id: "classify", name: "Classifier", description: "Categorize inputs into defined labels.", icon: "tags" },
  { id: "tts", name: "Text to Speech", description: "Convert text into natural-sounding audio.", icon: "volume-2" },
];

export const NODE_PALETTE = [
  { kind: "trigger", label: "Trigger", icon: "play", desc: "Starts the workflow with user input" },
  { kind: "model", label: "Language Model", icon: "sparkles", desc: "Generates text with an LLM" },
  { kind: "tool", label: "Tool", icon: "wrench", desc: "Runs an action like search, HTTP, or TTS" },
  { kind: "knowledge", label: "Knowledge", icon: "database", desc: "Injects documents as context" },
  { kind: "memory", label: "Memory", icon: "brain", desc: "Save and recall values across runs" },
  { kind: "router", label: "Router", icon: "git-branch", desc: "Branch the workflow by keyword" },
  { kind: "image-gen", label: "Image Generator", icon: "image", desc: "Creates images from a text prompt" },
  { kind: "vision", label: "Vision", icon: "eye", desc: "Understands images with GLM-4.5V" },
  { kind: "output", label: "Output", icon: "flag", desc: "Returns the final result" },
] as const;

export const IMAGE_SIZES = [
  { id: "1024x1024", label: "Square 1024×1024" },
  { id: "1344x768", label: "Landscape 1344×768" },
  { id: "768x1344", label: "Portrait 768×1344" },
  { id: "1152x864", label: "Landscape 1152×864" },
  { id: "864x1152", label: "Portrait 864×1152" },
] as const;

export interface PlatformDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type?: "text" | "password" | "url" }[];
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "web", name: "Web Widget", icon: "globe", color: "bg-emerald-500/15 text-emerald-500",
    description: "Embed the agent as a chat widget on any website.",
    fields: [
      { key: "allowedDomains", label: "Allowed domains", placeholder: "example.com, *.myapp.com", type: "text" },
    ],
  },
  {
    id: "api", name: "REST API", icon: "webhook", color: "bg-primary/15 text-primary",
    description: "Call the agent from any backend via a public endpoint.",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-...", type: "password" },
    ],
  },
  {
    id: "facebook", name: "Facebook Messenger", icon: "message-circle", color: "bg-blue-500/15 text-blue-500",
    description: "Respond to messages on your Facebook Page.",
    fields: [
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAB...", type: "password" },
      { key: "verifyToken", label: "Verify Token", placeholder: "your-verify-token", type: "text" },
      { key: "appId", label: "App ID", placeholder: "1234567890", type: "text" },
    ],
  },
  {
    id: "whatsapp", name: "WhatsApp", icon: "message-circle", color: "bg-green-500/15 text-green-500",
    description: "Handle WhatsApp Business messages via the Cloud API.",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "123...", type: "text" },
      { key: "accessToken", label: "Access Token", placeholder: "EAAJ...", type: "password" },
      { key: "verifyToken", label: "Webhook Verify Token", placeholder: "your-verify-token", type: "text" },
    ],
  },
  {
    id: "telegram", name: "Telegram", icon: "send", color: "bg-cyan-500/15 text-cyan-500",
    description: "Connect the agent to a Telegram bot.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "123456:ABC-DEF...", type: "password" },
    ],
  },
  {
    id: "slack", name: "Slack", icon: "hash", color: "bg-purple-500/15 text-purple-500",
    description: "Respond to mentions and DMs in Slack.",
    fields: [
      { key: "botToken", label: "Bot User OAuth Token", placeholder: "xoxb-...", type: "password" },
      { key: "signingSecret", label: "Signing Secret", placeholder: "abc123...", type: "password" },
    ],
  },
  {
    id: "discord", name: "Discord", icon: "message-square", color: "bg-indigo-500/15 text-indigo-400",
    description: "Connect the agent to a Discord bot.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "MTk4N...", type: "password" },
      { key: "applicationId", label: "Application ID", placeholder: "1234567890", type: "text" },
    ],
  },
  {
    id: "email", name: "Email", icon: "mail", color: "bg-amber-500/15 text-amber-500",
    description: "Auto-reply to incoming emails via SMTP/IMAP.",
    fields: [
      { key: "emailAddress", label: "Inbox address", placeholder: "support@yourco.com", type: "text" },
      { key: "imapHost", label: "IMAP host", placeholder: "imap.gmail.com", type: "text" },
      { key: "smtpHost", label: "SMTP host", placeholder: "smtp.gmail.com", type: "text" },
    ],
  },
  {
    id: "sms", name: "SMS (Twilio)", icon: "smartphone", color: "bg-rose-500/15 text-rose-500",
    description: "Send and receive SMS via Twilio.",
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "AC...", type: "text" },
      { key: "authToken", label: "Auth Token", placeholder: "••••", type: "password" },
      { key: "fromNumber", label: "From number", placeholder: "+1...", type: "text" },
    ],
  },
];

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
  {
    name: "Smart Triage Router",
    description: "Routes messages by keyword to specialized responder models.",
    icon: "git-branch",
    category: "support",
    tags: ["router", "triage", "branching"],
    featured: true,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Message", content: "Incoming user message" }),
      node("r1", "router", { x: 320, y: 200 }, { label: "Router", routerConditions: [
        { keyword: "billing", targetNodeId: "m-billing" },
        { keyword: "bug", targetNodeId: "m-bug" },
      ], routerDefault: "m-general" }),
      node("m-billing", "model", { x: 640, y: 60 }, { label: "Billing Expert", provider: "glm-4.5", systemPrompt: "You handle billing questions. Be precise about invoices, refunds, and plans." }),
      node("m-bug", "model", { x: 640, y: 200 }, { label: "Bug Expert", provider: "glm-4.6", systemPrompt: "You handle bug reports. Ask for steps to reproduce and the expected vs actual behavior." }),
      node("m-general", "model", { x: 640, y: 340 }, { label: "General Help", provider: "glm-4.5-air", systemPrompt: "You handle general questions. Be friendly and concise." }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Reply" }),
    ],
    edges: [edge("t1", "r1"), edge("r1", "m-billing"), edge("r1", "m-bug"), edge("r1", "m-general"), edge("m-billing", "o1"), edge("m-bug", "o1"), edge("m-general", "o1")],
  },
  {
    name: "Memory Assistant",
    description: "Remembers your name and context across runs using a memory node.",
    icon: "brain",
    category: "productivity",
    tags: ["memory", "personal", "context"],
    featured: true,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Message", content: "Tell me about yourself" }),
      node("mem1", "memory", { x: 300, y: 60 }, { label: "Recall", memoryKey: "user-profile", memoryMode: "load" }),
      node("m1", "model", { x: 600, y: 200 }, { label: "Respond", provider: "glm-4.5", systemPrompt: "You are a personal assistant. Use the recalled memory to personalize your response. If the user shares their name or preferences, mention you'll remember them." }),
      node("mem2", "memory", { x: 900, y: 60 }, { label: "Save", memoryKey: "user-profile", memoryMode: "save" }),
      node("o1", "output", { x: 900, y: 200 }, { label: "Reply" }),
    ],
    edges: [edge("t1", "mem1"), edge("t1", "m1"), edge("mem1", "m1"), edge("m1", "mem2"), edge("m1", "o1")],
  },
  {
    name: "API-Powered Analyst",
    description: "Fetches live data from any REST API, then analyses it with GLM.",
    icon: "webhook",
    category: "engineering",
    tags: ["http", "api", "data"],
    featured: false,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Query", content: "e.g. bitcoin price, weather in Nairobi" }),
      node("tl1", "tool", { x: 320, y: 200 }, { label: "Fetch API", tool: "http-request", httpMethod: "GET", httpUrl: "https://api.example.com/data?q={{input}}" }),
      node("m1", "model", { x: 640, y: 200 }, { label: "Analyse", provider: "glm-4.6", systemPrompt: "You are a data analyst. Given raw API data, extract the key insights and present them clearly with numbers and a brief summary." }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Analysis" }),
    ],
    edges: [edge("t1", "tl1"), edge("tl1", "m1"), edge("m1", "o1")],
  },
  {
    name: "Voice Narrator",
    description: "Turns text into a spoken audio response using text-to-speech.",
    icon: "database",
    category: "content",
    tags: ["tts", "audio", "voice"],
    featured: false,
    nodes: [
      node("t1", "trigger", { x: 0, y: 200 }, { label: "Text", content: "Text to narrate" }),
      node("m1", "model", { x: 320, y: 200 }, { label: "Polish", provider: "glm-4.5-air", systemPrompt: "Rewrite the input as clear, natural narration suitable for text-to-speech." }),
      node("tl1", "tool", { x: 640, y: 200 }, { label: "Speak", tool: "tts", ttsVoice: "default" }),
      node("o1", "output", { x: 960, y: 200 }, { label: "Audio" }),
    ],
    edges: [edge("t1", "m1"), edge("m1", "tl1"), edge("tl1", "o1")],
  },
];
