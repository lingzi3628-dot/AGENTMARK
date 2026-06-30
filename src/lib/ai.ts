import ZAI from "z-ai-web-dev-sdk";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from "./types";

// Singleton ZAI client
let _zai: ZAI | null = null;

// Ensure the z-ai config file exists. On Railway/production, the config is
// provided via env vars (ZAI_BASE_URL, ZAI_API_KEY) — we write it to a file
// that the SDK can read. On the sandbox, the file already exists at /etc/.
async function ensureConfig() {
  const configPath = path.join(process.cwd(), ".z-ai-config");
  try {
    await fs.access(configPath);
    return; // already exists
  } catch {
    // doesn't exist — create from env vars if available
  }
  const baseUrl = process.env.ZAI_BASE_URL || process.env.NEXT_PUBLIC_ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY || process.env.NEXT_PUBLIC_ZAI_API_KEY;
  if (baseUrl && apiKey) {
    const config = JSON.stringify({ baseUrl, apiKey });
    await fs.writeFile(configPath, config, "utf-8").catch(() => undefined);
  }
}

export async function getZAI() {
  // Skip the SDK entirely if no config file exists (e.g. on Railway/production
  // without ZAI_API_KEY). We use the direct HTTP fallback instead.
  const hasConfig = await hasZaiConfig();
  if (!hasConfig) return null;
  if (!_zai) {
    await ensureConfig();
    _zai = await ZAI.create();
  }
  return _zai;
}

/** Check if any z-ai config file exists. */
async function hasZaiConfig(): Promise<boolean> {
  if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) return true;
  try {
    await fs.access(path.join(process.cwd(), ".z-ai-config"));
    return true;
  } catch {
    // check home dir and /etc
  }
  try {
    await fs.access(path.join(os.homedir(), ".z-ai-config"));
    return true;
  } catch {
    // not in home
  }
  try {
    await fs.access("/etc/.z-ai-config");
    return true;
  } catch {
    return false;
  }
}

// In-process memory store (persists across runs within the server lifetime).
const memoryStore = new Map<string, string>();

const TOOL_PROMPTS: Record<string, string> = {
  summarize:
    "You are a summarization engine. Produce a concise, faithful summary of the input. Use bullet points for key takeaways.",
  translate:
    "You are a professional translator. Translate the input to the target language requested (default: English). Preserve tone and meaning.",
  code:
    "You are an expert software engineer. Given the input, produce clean, idiomatic, well-commented code. Explain briefly if helpful.",
  classify:
    "You are a classification engine. Categorize the input into the most relevant label and briefly justify. Output: Label — reason.",
};

/** Topologically sort nodes by edges (Kahn's algorithm). */
export function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.target)) indeg.set(e.target, 0);
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  // append any remaining (cyclic/disconnected) to avoid dropping nodes
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

export interface ExecEvent {
  type: "trace" | "delta" | "done" | "error";
  node?: string;
  label?: string;
  status?: string;
  content?: string;
  output?: string;
  tokens?: number;
  duration?: number;
  message?: string;
}

export interface ExecContext {
  input: string;
  history: { role: "user" | "assistant"; content: string }[];
}

/**
 * Execute an agent graph and yield SSE-style events.
 * Intermediate nodes run non-streamed; the terminal generation node streams.
 */
export async function* executeAgent(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  ctx: ExecContext,
): AsyncGenerator<ExecEvent> {
  const started = Date.now();
  const order = topoSort(nodes, edges);
  const outputs = new Map<string, string>();
  let zai: ZAI | null = null;
  try {
    zai = await getZAI();
  } catch (e) {
    // SDK config not available — we'll use direct HTTP fallback in runCompletion
    console.log("[agentmark] SDK unavailable, using free API fallback:", e instanceof Error ? e.message : "unknown");
    zai = null;
  }

  // upstream outputs for a node
  const upstream = (id: string) =>
    edges
      .filter((e) => e.target === id)
      .map((e) => outputs.get(e.source))
      .filter(Boolean) as string[];

  const incomingContext = (id: string) => upstream(id).join("\n\n---\n\n") || ctx.input;

  // Determine the terminal generation node (the one feeding an output node, else last generation-capable node)
  const genKinds = ["model", "tool", "vision", "image-gen", "memory", "router"];
  const outputNode = nodes.find((n) => n.data.kind === "output");
  const terminalGenId = outputNode
    ? (edges.find((e) => e.target === outputNode.id)?.source ??
        [...order].reverse().find((n) => genKinds.includes(n.data.kind))?.id)
    : [...order].reverse().find((n) => genKinds.includes(n.data.kind))?.id;

  let totalTokens = 0;

  for (const node of order) {
    const data = node.data;
    const label = data.label || data.kind;
    yield { type: "trace", node: node.id, label, status: "running" };

    try {
      if (data.kind === "trigger") {
        outputs.set(node.id, ctx.input);
      } else if (data.kind === "knowledge") {
        const text = data.content || "Knowledge context.";
        outputs.set(node.id, text);
      } else if (data.kind === "tool" && data.tool === "web-search") {
        const query = incomingContext(node.id).slice(0, 200) || ctx.input;
        if (!zai) {
          outputs.set(node.id, `Web search unavailable (no SDK config). Query was: "${query}"`);
        } else {
        try {
          const results = await zai.functions.invoke("web_search", { query, num: 5 });
          const formatted = results
            .map((r, i) => `${i + 1}. ${r.name}\n   ${r.snippet}\n   ${r.url}`)
            .join("\n\n");
          outputs.set(node.id, `Web search results for "${query}":\n\n${formatted}`);
          totalTokens += Math.ceil(formatted.length / 4);
        } catch {
          outputs.set(node.id, `Web search was unavailable for: "${query}". Proceeding with reasoning only.`);
        }
        }
      } else if (data.kind === "tool" && data.tool === "page-reader") {
        // Treat upstream text as a URL; extract clean page content.
        const url = (incomingContext(node.id).match(/https?:\/\/\S+/)?.[0] || "").trim();
        if (!url) {
          outputs.set(node.id, "Page Reader: no URL found in upstream input.");
        } else if (!zai) {
          outputs.set(node.id, `Page Reader unavailable (no SDK config). URL was: ${url}`);
        } else {
          try {
            const result = await zai.functions.invoke("page_reader", { url });
            const title = result?.data?.title ?? "";
            const html = result?.data?.html ?? "";
            // Strip HTML tags for a plain-text snapshot (compact)
            const text = html
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 4000);
            outputs.set(node.id, `Page: ${title}\nURL: ${url}\n\n${text}`);
            totalTokens += Math.ceil(text.length / 4);
          } catch {
            outputs.set(node.id, `Page Reader: could not fetch ${url}.`);
          }
        }
      } else if (data.kind === "tool" && data.tool === "http-request") {
        // Call any REST endpoint. URL/templates support {{input}} substitution.
        const incoming = incomingContext(node.id);
        let url = (data.httpUrl ?? "").trim();
        if (!url) {
          // If no URL set, treat upstream itself as the URL.
          url = (incoming.match(/https?:\/\/\S+/)?.[0] ?? "").trim();
        }
        if (!url) {
          outputs.set(node.id, "HTTP Request: no URL configured.");
        } else {
          url = url.replace(/\{\{input\}\}/g, encodeURIComponent(incoming.slice(0, 500)));
          const method = data.httpMethod ?? "GET";
          try {
            const headers: Record<string, string> = {};
            if (data.httpHeaders) {
              try { Object.assign(headers, JSON.parse(data.httpHeaders)); } catch { /* ignore */ }
            }
            const res = await fetch(url, {
              method,
              headers,
              body: method === "POST" ? (data.httpBody ?? undefined) : undefined,
            });
            const text = await res.text();
            const trimmed = text.slice(0, 4000);
            outputs.set(node.id, `HTTP ${method} ${url} → ${res.status}\n\n${trimmed}`);
            totalTokens += Math.ceil(trimmed.length / 4);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "fetch failed";
            outputs.set(node.id, `HTTP Request failed: ${msg}`);
          }
        }
      } else if (data.kind === "tool" && data.tool === "tts") {
        const text = incomingContext(node.id).slice(0, 1000) || ctx.input;
        if (!zai) {
          outputs.set(node.id, "[TTS unavailable — no SDK config]");
        } else {
        try {
          const res = await zai.audio.tts.create({
            input: text,
            voice: data.ttsVoice ?? "default",
          });
          // res is an audio buffer/stream; we surface a markdown audio link.
          // Many TTS SDKs return base64 — handle both shapes defensively.
          const b64 =
            (res as { data?: string })?.data ??
            (res as { audio?: string })?.audio ??
            "";
          if (b64) {
            const dataUrl = `data:audio/mpeg;base64,${b64}`;
            outputs.set(node.id, dataUrl);
            yield { type: "delta", content: `\n\n🔊 [Audio response](\`${dataUrl.slice(0, 80)}…\`)\n` };
          } else {
            outputs.set(node.id, "[TTS: no audio returned]");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "tts failed";
          outputs.set(node.id, `[TTS error: ${msg}]`);
        }
        }
      } else if (data.kind === "tool") {
        const sys = TOOL_PROMPTS[data.tool ?? "summarize"] ?? TOOL_PROMPTS.summarize;
        const out = await runCompletion(zai, sys, incomingContext(node.id), data.provider, ctx.history, data);
        outputs.set(node.id, out);
        totalTokens += Math.ceil(out.length / 4);
      } else if (data.kind === "image-gen") {
        // Generate an image from the upstream prompt.
        const prompt = incomingContext(node.id).slice(0, 1000) || ctx.input;
        yield { type: "trace", node: node.id, label, status: "streaming" };
        if (!zai) {
          outputs.set(node.id, "[Image generation unavailable — no SDK config]");
        } else {
        try {
          const res = await zai.images.generations.create({
            prompt,
            size: data.imageSize ?? "1024x1024",
          });
          const b64 = res?.data?.[0]?.base64;
          if (b64) {
            const dataUrl = `data:image/png;base64,${b64}`;
            outputs.set(node.id, dataUrl);
            // Emit a special image delta so the chat can render it.
            yield { type: "delta", content: `\n![generated image](${dataUrl})\n` };
          } else {
            outputs.set(node.id, "[image generation returned no data]");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "image gen failed";
          outputs.set(node.id, `[image error: ${msg}]`);
        }
        }
      } else if (data.kind === "vision") {
        // Multimodal: analyse the node's attached image with the upstream prompt.
        const prompt = incomingContext(node.id) || "Describe this image.";
        const imageUrl = data.imageUrl;
        if (!imageUrl) {
          outputs.set(node.id, "[vision: no image attached]");
        } else if (!zai) {
          outputs.set(node.id, "[vision unavailable — no SDK config]");
        } else {
          if (node.id === terminalGenId) {
            yield { type: "trace", node: node.id, label, status: "streaming" };
            let full = "";
            for await (const chunk of streamVision(zai, prompt, imageUrl, ctx.history)) {
              full += chunk;
              yield { type: "delta", content: chunk };
            }
            outputs.set(node.id, full);
            totalTokens += Math.ceil(full.length / 4);
          } else {
            const out = await runVision(zai, prompt, imageUrl, ctx.history);
            outputs.set(node.id, out);
            totalTokens += Math.ceil(out.length / 4);
          }
        }
      } else if (data.kind === "memory") {
        const key = data.memoryKey || "default";
        const mode = data.memoryMode ?? "load";
        const incoming = incomingContext(node.id);
        let result = "";
        if (mode === "save" || mode === "both") {
          memoryStore.set(key, incoming.slice(0, 8000));
        }
        if (mode === "load" || mode === "both") {
          const stored = memoryStore.get(key) ?? "";
          result = stored ? `Memory[${key}]:\n${stored}` : `Memory[${key}] is empty.`;
        } else {
          result = `Saved to memory[${key}].`;
        }
        outputs.set(node.id, result);
      } else if (data.kind === "router") {
        // A router doesn't transform data; it passes through upstream and
        // emits a trace note about which branch would be taken. The actual
        // branching is handled by the topological order + edge connections.
        const incoming = incomingContext(node.id);
        const conds = data.routerConditions ?? [];
        const matched = conds.find((c) =>
          c.keyword && c.keyword.trim() && incoming.toLowerCase().includes(c.keyword.toLowerCase()),
        );
        const note = matched
          ? `Routed to "${matched.targetNodeId}" (matched "${matched.keyword}")`
          : `Routed to default (${data.routerDefault ?? "fall-through"})`;
        outputs.set(node.id, incoming);
        yield { type: "trace", node: node.id, label: `${label}: ${note}`, status: "streaming" };
      } else if (data.kind === "model") {
        const sys = data.systemPrompt || "You are a helpful AI agent.";
        const context = incomingContext(node.id);
        if (node.id === terminalGenId) {
          // Stream this one
          yield { type: "trace", node: node.id, label, status: "streaming" };
          let full = "";
          for await (const chunk of streamCompletion(zai, sys, context, data.provider, ctx.history, data)) {
            full += chunk;
            yield { type: "delta", content: chunk };
          }
          outputs.set(node.id, full);
          totalTokens += Math.ceil(full.length / 4);
        } else {
          const out = await runCompletion(zai, sys, context, data.provider, ctx.history, data);
          outputs.set(node.id, out);
          totalTokens += Math.ceil(out.length / 4);
        }
      } else if (data.kind === "output") {
        const out = upstream(node.id).join("\n\n") || outputs.get(terminalGenId ?? "") || "";
        outputs.set(node.id, out);
      }
      yield { type: "trace", node: node.id, label, status: "done" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      outputs.set(node.id, `[error: ${msg}]`);
      yield { type: "trace", node: node.id, label, status: "error" };
    }
  }

  const finalOutput =
    outputs.get(outputNode?.id ?? "") ||
    outputs.get(terminalGenId ?? "") ||
    ctx.input;

  yield {
    type: "done",
    output: finalOutput,
    tokens: totalTokens,
    duration: Date.now() - started,
  };
}

async function runCompletion(
  zai: ZAI | null,
  system: string,
  user: string,
  model: WorkflowNodeData["provider"],
  history: { role: "user" | "assistant"; content: string }[],
  nodeData?: WorkflowNodeData,
): Promise<string> {
  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-6),
    { role: "user" as const, content: user || "(empty input)" },
  ];
  // Try the SDK first; fall back to direct HTTP if it fails or isn't available
  if (zai) {
    try {
      const res = await zai.chat.completions.create({
        model: model ?? "glm-4.5-air",
        messages,
        thinking: { type: "disabled" },
      });
      return res?.choices?.[0]?.message?.content ?? "";
    } catch {
      // fall through to direct
    }
  }
  return directCompletion(system, user, model, history, nodeData);
}

/**
 * AGENTMARK model routing:
 * - free-* models → free API (no key needed, default)
 * - glm-* models → GLM API (needs ZAI_BASE_URL + ZAI_API_KEY env vars)
 * - custom → user-provided customApiUrl + customApiKey + customModelName
 */

const FREE_API_URL = "https://text.pollinations.ai/openai";
const FREE_MODEL_MAP: Record<string, string> = {
  "free-openai": "openai",
  "free-mistral": "mistral",
  "free-llama": "llama",
  "free-qwen": "qwen",
};

/** Resolve which API + model to use based on the provider ID. */
function resolveModel(provider: WorkflowNodeData["provider"] | undefined) {
  const p = provider ?? "free-openai";
  if (p.startsWith("free-")) {
    return {
      type: "free" as const,
      apiModel: FREE_MODEL_MAP[p] ?? "openai",
      apiUrl: FREE_API_URL,
      apiKey: "",
    };
  }
  if (p.startsWith("glm-")) {
    return {
      type: "glm" as const,
      apiModel: p,
      apiUrl: process.env.ZAI_BASE_URL || "",
      apiKey: process.env.ZAI_API_KEY || "",
    };
  }
  return {
    type: "free" as const,
    apiModel: "openai",
    apiUrl: FREE_API_URL,
    apiKey: "",
  };
}

/** Direct HTTP completion — routes to free, GLM, or custom API. */
async function directCompletion(
  system: string,
  user: string,
  model: WorkflowNodeData["provider"] | undefined,
  history: { role: "user" | "assistant"; content: string }[],
  nodeData?: WorkflowNodeData,
): Promise<string> {
  const messages = [
    { role: "system", content: system },
    ...history.slice(-6),
    { role: "user", content: user || "(empty input)" },
  ];

  // Custom model (user-provided API)
  if (model === "custom" && nodeData?.customApiUrl) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (nodeData.customApiKey) headers.authorization = `Bearer ${nodeData.customApiKey}`;
    const res = await fetch(`${nodeData.customApiUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: nodeData.customModelName || "gpt-4o-mini",
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Custom API ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  const route = resolveModel(model);

  // GLM API (premium — needs env vars)
  if (route.type === "glm" && route.apiUrl && route.apiKey) {
    try {
      const res = await fetch(`${route.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${route.apiKey}`,
          "X-Z-AI-From": "Z",
        },
        body: JSON.stringify({
          model: route.apiModel,
          messages,
          thinking: { type: "disabled" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch {
      // fall through to free API
    }
  }

  // Free API (no key required) — default for all users
  const res = await fetch(FREE_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: route.apiModel,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`AGENTMARK Free API ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function* streamCompletion(
  zai: ZAI | null,
  system: string,
  user: string,
  model: WorkflowNodeData["provider"],
  history: { role: "user" | "assistant"; content: string }[],
  nodeData?: WorkflowNodeData,
): AsyncGenerator<string> {
  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-6),
    { role: "user" as const, content: user || "(empty input)" },
  ];
  // Try the SDK streaming first; fall back to direct HTTP streaming
  if (zai) {
    try {
      const body = await zai.chat.completions.create({
        model: model ?? "glm-4.5-air",
        messages,
        stream: true,
        thinking: { type: "disabled" },
      });
      const stream = body as ReadableStream<Uint8Array>;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) yield delta as string;
          } catch {
            // partial JSON
          }
        }
      }
      return;
    } catch {
      // fall through to direct streaming
    }
  }
  // Direct HTTP streaming fallback
  yield* directStream(system, user, model, history, nodeData);
}

/** Direct streaming via fetch — routes to free, GLM, or custom API. */
async function* directStream(
  system: string,
  user: string,
  model: WorkflowNodeData["provider"] | undefined,
  history: { role: "user" | "assistant"; content: string }[],
  nodeData?: WorkflowNodeData,
): AsyncGenerator<string> {
  const messages = [
    { role: "system", content: system },
    ...history.slice(-6),
    { role: "user", content: user || "(empty input)" },
  ];

  // Custom model (user-provided API)
  if (model === "custom" && nodeData?.customApiUrl) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (nodeData.customApiKey) headers.authorization = `Bearer ${nodeData.customApiKey}`;
    try {
      const res = await fetch(`${nodeData.customApiUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: nodeData.customModelName || "gpt-4o-mini",
          messages,
          stream: true,
        }),
      });
      if (res.ok && res.body) {
        yield* readSSEStream(res.body);
        return;
      }
    } catch {
      // fall through
    }
  }

  const route = resolveModel(model);

  // GLM API (premium)
  if (route.type === "glm" && route.apiUrl && route.apiKey) {
    try {
      const res = await fetch(`${route.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${route.apiKey}`,
          "X-Z-AI-From": "Z",
        },
        body: JSON.stringify({
          model: route.apiModel,
          messages,
          stream: true,
          thinking: { type: "disabled" },
        }),
      });
      if (res.ok && res.body) {
        yield* readSSEStream(res.body);
        return;
      }
    } catch {
      // fall through
    }
  }

  // Free API (no key required) — default
  const res = await fetch(FREE_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: route.apiModel,
      messages,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    // Non-streaming fallback
    const text = await directCompletion(system, user, model, history, nodeData);
    yield text;
    return;
  }
  yield* readSSEStream(res.body);
}

/** Read an SSE stream and yield content deltas. */
async function* readSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // partial
      }
    }
  }
}

async function runVision(
  zai: ZAI,
  prompt: string,
  imageUrl: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const res = await zai.chat.completions.createVision({
    model: "glm-4.5v",
    messages: [
      { role: "system", content: "You analyse images precisely and concisely." },
      ...history.slice(-4),
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });
  return res?.choices?.[0]?.message?.content ?? "";
}

async function* streamVision(
  zai: ZAI,
  prompt: string,
  imageUrl: string,
  history: { role: "user" | "assistant"; content: string }[],
): AsyncGenerator<string> {
  const body = await zai.chat.completions.createVision({
    model: "glm-4.5v",
    messages: [
      { role: "system", content: "You analyse images precisely and concisely." },
      ...history.slice(-4),
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    stream: true,
    thinking: { type: "disabled" },
  });
  const stream = body as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // partial JSON
      }
    }
  }
}

/** Serialize ExecEvent generator into an SSE response stream. */
export function toSSEResponse(events: AsyncGenerator<ExecEvent>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of events) {
          controller.enqueue(encoder.encode(`event: ${ev.type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}
