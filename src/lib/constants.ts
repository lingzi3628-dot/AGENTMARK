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
  procedure: { title: string; body: string }[];
  docsUrl?: string;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "web", name: "Web Widget", icon: "globe", color: "bg-emerald-500/15 text-emerald-500",
    description: "Embed the agent as a chat widget on any website.",
    fields: [
      { key: "allowedDomains", label: "Allowed domains", placeholder: "example.com, *.myapp.com", type: "text" },
    ],
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/webhook",
    procedure: [
      { title: "Publish your agent", body: "Go to the Publish tab and toggle the publish switch ON. Copy your public slug (e.g. my-agent)." },
      { title: "Get the embed code", body: "In the Publish tab, copy the Script, iframe, or React snippet provided. The script tag auto-injects a floating chat widget in the bottom-right corner." },
      { title: "Add to your website", body: "Paste the embed code into your website's HTML, just before the closing </body> tag. The widget loads instantly on page load." },
      { title: "Set allowed domains (optional)", body: "Enter the domains where the widget will appear (e.g. example.com, *.myapp.com). Leave blank to allow all domains." },
      { title: "Test it", body: "Open your website — the chat bubble appears in the bottom-right. Click it and send a message to verify the agent responds." },
    ],
  },
  {
    id: "api", name: "REST API", icon: "webhook", color: "bg-primary/15 text-primary",
    description: "Call the agent from any backend via a public endpoint.",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-...", type: "password" },
    ],
    docsUrl: "https://platform.openai.com/docs/api-reference",
    procedure: [
      { title: "Publish your agent", body: "Go to Publish → toggle ON. Note your public slug." },
      { title: "Generate an API key", body: "Enter any secure string as your API key (e.g. generate one at random.org). This key authenticates requests to your agent." },
      { title: "Call the endpoint", body: "POST to /api/public/run/{slug} with headers { 'content-type': 'application/json', 'x-api-key': 'your-key' } and body { input: 'your message', history: [] }. The response is a streaming SSE event stream." },
      { title: "Parse the stream", body: "Read the response body as Server-Sent Events. Each line starts with 'event: trace' or 'event: delta' followed by 'data: {json}'. Accumulate 'delta' events to build the full response." },
      { title: "Example (Node.js)", body: "const res = await fetch('/api/public/run/my-slug', { method:'POST', headers:{'content-type':'application/json','x-api-key':'sk-...'}, body:JSON.stringify({input:'Hello'}) }); const reader = res.body.getReader(); // read SSE chunks" },
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
    docsUrl: "https://developers.facebook.com/docs/messenger-platform/getting-started",
    procedure: [
      { title: "Create a Meta App", body: "Go to developers.facebook.com → My Apps → Create App → select 'Business' type. Name it and create." },
      { title: "Add Messenger product", body: "In your app dashboard, scroll to 'Add Product' → find 'Messenger' → click 'Set Up'." },
      { title: "Generate a Page Access Token", body: "In Messenger settings → 'Access Tokens' section → select your Facebook Page → click 'Generate Token'. Copy the token (starts with EAAB...)." },
      { title: "Set a Verify Token", body: "In the 'Webhooks' section, enter any string as your Verify Token (e.g. 'my_agent_verify_2024'). Copy this — you'll enter it here too." },
      { title: "Subscribe your Page", body: "Under 'Webhooks', click 'Add Subscription' and select 'messages' and 'messaging_postbacks'. Then click 'Subscribe' next to your Page." },
      { title: "Enter credentials here", body: "Paste your Page Access Token, Verify Token, and App ID into the fields above, then click Connect." },
      { title: "Set the webhook URL", body: "In your Facebook app's webhook settings, set the Callback URL to: https://your-domain.com/api/webhooks/facebook and use the same Verify Token. Your agent now replies to Messenger messages!" },
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
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    procedure: [
      { title: "Create a Meta Business App", body: "Go to developers.facebook.com → Create App → select 'Business'. Add the 'WhatsApp' product." },
      { title: "Get your Phone Number ID", body: "In WhatsApp settings → 'Phone Number' section, copy the Phone Number ID (a numeric string)." },
      { title: "Generate an Access Token", body: "Scroll to 'Temporary Access Token' → copy it (starts with EAAJ...). For production, generate a permanent System User token in Business Manager." },
      { title: "Configure the webhook", body: "In WhatsApp settings → 'Webhook' section → click 'Configure'. Set Callback URL to: https://your-domain.com/api/webhooks/whatsapp. Enter a Verify Token (any string) and subscribe to 'messages'." },
      { title: "Add a test number", body: "In 'To' field, add your own WhatsApp number to test. WhatsApp Cloud API starts in sandbox mode — only test numbers work until you verify your business." },
      { title: "Enter credentials here", body: "Paste your Phone Number ID, Access Token, and Verify Token into the fields, then click Connect. Your agent now replies to WhatsApp messages!" },
    ],
  },
  {
    id: "telegram", name: "Telegram", icon: "send", color: "bg-cyan-500/15 text-cyan-500",
    description: "Connect the agent to a Telegram bot.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "123456:ABC-DEF...", type: "password" },
    ],
    docsUrl: "https://core.telegram.org/bots#how-do-i-create-a-bot",
    procedure: [
      { title: "Open BotFather", body: "In Telegram, search for '@BotFather' and start a chat. BotFather is Telegram's official bot for creating other bots." },
      { title: "Create a new bot", body: "Send the command /newbot. BotFather will ask for a name (display name, e.g. 'My Support Agent') and a username (must end in 'bot', e.g. 'mysupport_agent_bot')." },
      { title: "Copy your Bot Token", body: "BotFather returns a token like '123456789:ABCdefGhIjKlMnO...'. Copy this — it's your Bot Token." },
      { title: "Enter the token here", body: "Paste the Bot Token into the field above and click Connect. The system registers your webhook with Telegram automatically." },
      { title: "Test your bot", body: "In Telegram, search for your bot's username → click Start → send a message. Your agent will reply within seconds!" },
      { title: "Customize (optional)", body: "With BotFather, use /setdescription, /setuserpic, and /setcommands to customize your bot's appearance and add a command menu." },
    ],
  },
  {
    id: "slack", name: "Slack", icon: "hash", color: "bg-purple-500/15 text-purple-500",
    description: "Respond to mentions and DMs in Slack.",
    fields: [
      { key: "botToken", label: "Bot User OAuth Token", placeholder: "xoxb-...", type: "password" },
      { key: "signingSecret", label: "Signing Secret", placeholder: "abc123...", type: "password" },
    ],
    docsUrl: "https://api.slack.com/start/building/bolt",
    procedure: [
      { title: "Create a Slack App", body: "Go to api.slack.com/apps → 'Create New App' → 'From scratch'. Name it and select your workspace." },
      { title: "Add Bot scopes", body: "In 'OAuth & Permissions' → 'Bot Token Scopes' → add: chat:write, app_mentions:read, im:history, im:read, im:write." },
      { title: "Install to workspace", body: "Click 'Install to Workspace' at the top. Authorize the app. You'll get a Bot User OAuth Token (starts with xoxb-). Copy it." },
      { title: "Copy the Signing Secret", body: "Go to 'Basic Information' → 'App Credentials' → copy the 'Signing Secret'. This verifies incoming webhook requests." },
      { title: "Enable Event Subscriptions", body: "Go to 'Event Subscriptions' → toggle ON. Set the Request URL to: https://your-domain.com/api/webhooks/slack. Subscribe to bot events: app_mention, message.im." },
      { title: "Enter credentials here", body: "Paste your Bot Token (xoxb-) and Signing Secret into the fields, then click Connect. Mention your bot with @YourBotName in any channel to trigger it!" },
    ],
  },
  {
    id: "discord", name: "Discord", icon: "message-square", color: "bg-indigo-500/15 text-indigo-400",
    description: "Connect the agent to a Discord bot.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "MTk4N...", type: "password" },
      { key: "applicationId", label: "Application ID", placeholder: "1234567890", type: "text" },
    ],
    docsUrl: "https://discord.com/developers/docs/getting-started",
    procedure: [
      { title: "Create an application", body: "Go to discord.com/developers/applications → 'New Application'. Name it (e.g. 'AgentMark Bot') and create." },
      { title: "Copy the Application ID", body: "In 'General Information' → copy the 'Application ID' (a numeric string). You'll need this for the invite link." },
      { title: "Create a bot user", body: "Go to the 'Bot' tab → click 'Add Bot' → confirm. This creates the bot account that will respond to messages." },
      { title: "Copy the Bot Token", body: "On the same Bot page → click 'Reset Token' (or 'Copy' if already generated). Copy the token (starts with MTk4N... or similar). NEVER share this token." },
      { title: "Enable Message Content Intent", body: "Scroll down to 'Privileged Gateway Intents' → toggle ON 'Message Content Intent'. This lets the bot read message text." },
      { title: "Invite the bot to your server", body: "Go to 'OAuth2' → 'URL Generator' → select scopes: bot, applications.commands. Select permissions: Send Messages, Read Message History. Open the generated URL and add the bot to your server." },
      { title: "Enter credentials here", body: "Paste your Bot Token and Application ID into the fields, then click Connect. Mention or DM the bot in Discord to chat with your agent!" },
    ],
  },
  {
    id: "email", name: "Email", icon: "mail", color: "bg-amber-500/15 text-amber-500",
    description: "Auto-reply to incoming emails via SMTP/IMAP.",
    fields: [
      { key: "emailAddress", label: "Inbox address", placeholder: "support@yourco.com", type: "text" },
      { key: "imapHost", label: "IMAP host", placeholder: "imap.gmail.com", type: "text" },
      { key: "smtpHost", label: "SMTP host", placeholder: "smtp.gmail.com", type: "text" },
      { key: "password", label: "App password", placeholder: "••••", type: "password" },
    ],
    docsUrl: "https://support.google.com/mail/answer/185833",
    procedure: [
      { title: "Use a dedicated email account", body: "Create a dedicated inbox (e.g. support@yourco.com or a Gmail account). Don't use your personal email — the agent will reply to all incoming messages." },
      { title: "Enable IMAP access", body: "In Gmail: Settings → See all settings → Forwarding and POP/IMAP → enable IMAP. For other providers, find the IMAP setting in your mail settings." },
      { title: "Generate an App Password", body: "For Gmail: go to myaccount.google.com → Security → 2-Step Verification → App passwords → generate one for 'Mail'. For other providers, use your regular password or generate an app-specific password." },
      { title: "Find your IMAP/SMTP hosts", body: "Gmail: imap.gmail.com and smtp.gmail.com. Outlook: outlook.office365.com and smtp.office365.com. Check your provider's docs for custom domains." },
      { title: "Enter credentials here", body: "Fill in the inbox address, IMAP host, SMTP host, and app password. Click Connect. The system polls your inbox and auto-replies using your agent." },
      { title: "Test it", body: "Send a test email to your agent's inbox from a different account. Within a minute, your agent will reply automatically." },
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
    docsUrl: "https://www.twilio.com/docs/sms/quickstart",
    procedure: [
      { title: "Create a Twilio account", body: "Sign up at twilio.com/try-twilio. You get a free trial with $15 credit — enough for testing." },
      { title: "Get a phone number", body: "In the Twilio console → 'Phone Numbers' → 'Buy a number' (or use the trial number). Choose one with SMS capability. Copy the number (E.164 format, e.g. +1234567890)." },
      { title: "Copy your Account SID", body: "On the Twilio console dashboard, copy your 'Account SID' (starts with AC...). This identifies your account." },
      { title: "Copy your Auth Token", body: "On the same dashboard, copy your 'Auth Token' (click the eye icon to reveal). Keep this secret — it authenticates all API calls." },
      { title: "Configure the webhook", body: "In 'Phone Numbers' → 'Active numbers' → click your number → 'Messaging' section. Set 'A Message Comes In' to: Webhook, URL: https://your-domain.com/api/webhooks/sms, method: POST." },
      { title: "Enter credentials here", body: "Paste your Account SID, Auth Token, and From Number (+1...) into the fields, then click Connect. Send an SMS to your Twilio number and the agent will reply!" },
      { title: "Upgrade from trial (optional)", body: "Trial accounts can only text verified numbers. Upgrade your account to text any number. Twilio charges ~$0.0079 per SMS in the US." },
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
