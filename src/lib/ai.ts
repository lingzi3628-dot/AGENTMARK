import ZAI from "z-ai-web-dev-sdk";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from "./types";

// Singleton ZAI client
let _zai: ZAI | null = null;
export async function getZAI() {
  if (!_zai) _zai = await ZAI.create();
  return _zai;
}

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
  const zai = await getZAI();

  // upstream outputs for a node
  const upstream = (id: string) =>
    edges
      .filter((e) => e.target === id)
      .map((e) => outputs.get(e.source))
      .filter(Boolean) as string[];

  const incomingContext = (id: string) => upstream(id).join("\n\n---\n\n") || ctx.input;

  // Determine the terminal generation node (the one feeding an output node, else last model/tool/vision/image-gen)
  const outputNode = nodes.find((n) => n.data.kind === "output");
  const terminalGenId = outputNode
    ? (edges.find((e) => e.target === outputNode.id)?.source ??
        [...order].reverse().find((n) => ["model", "tool", "vision", "image-gen"].includes(n.data.kind))?.id)
    : [...order].reverse().find((n) => ["model", "tool", "vision", "image-gen"].includes(n.data.kind))?.id;

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
      } else if (data.kind === "tool" && data.tool === "page-reader") {
        // Treat upstream text as a URL; extract clean page content.
        const url = (incomingContext(node.id).match(/https?:\/\/\S+/)?.[0] || "").trim();
        if (!url) {
          outputs.set(node.id, "Page Reader: no URL found in upstream input.");
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
      } else if (data.kind === "tool") {
        const sys = TOOL_PROMPTS[data.tool ?? "summarize"] ?? TOOL_PROMPTS.summarize;
        const out = await runCompletion(zai, sys, incomingContext(node.id), data.provider, ctx.history);
        outputs.set(node.id, out);
        totalTokens += Math.ceil(out.length / 4);
      } else if (data.kind === "image-gen") {
        // Generate an image from the upstream prompt.
        const prompt = incomingContext(node.id).slice(0, 1000) || ctx.input;
        yield { type: "trace", node: node.id, label, status: "streaming" };
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
      } else if (data.kind === "vision") {
        // Multimodal: analyse the node's attached image with the upstream prompt.
        const prompt = incomingContext(node.id) || "Describe this image.";
        const imageUrl = data.imageUrl;
        if (!imageUrl) {
          outputs.set(node.id, "[vision: no image attached]");
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
      } else if (data.kind === "model") {
        const sys = data.systemPrompt || "You are a helpful AI agent.";
        const context = incomingContext(node.id);
        if (node.id === terminalGenId) {
          // Stream this one
          yield { type: "trace", node: node.id, label, status: "streaming" };
          let full = "";
          for await (const chunk of streamCompletion(zai, sys, context, data.provider, ctx.history)) {
            full += chunk;
            yield { type: "delta", content: chunk };
          }
          outputs.set(node.id, full);
          totalTokens += Math.ceil(full.length / 4);
        } else {
          const out = await runCompletion(zai, sys, context, data.provider, ctx.history);
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
  zai: ZAI,
  system: string,
  user: string,
  model: WorkflowNodeData["provider"],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-6),
    { role: "user" as const, content: user || "(empty input)" },
  ];
  const res = await zai.chat.completions.create({
    model: model ?? "glm-4.5-air",
    messages,
    thinking: { type: "disabled" },
  });
  return res?.choices?.[0]?.message?.content ?? "";
}

async function* streamCompletion(
  zai: ZAI,
  system: string,
  user: string,
  model: WorkflowNodeData["provider"],
  history: { role: "user" | "assistant"; content: string }[],
): AsyncGenerator<string> {
  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-6),
    { role: "user" as const, content: user || "(empty input)" },
  ];
  const body = await zai.chat.completions.create({
    model: model ?? "glm-4.5-air",
    messages,
    stream: true,
    thinking: { type: "disabled" },
  });

  // body is a ReadableStream of SSE
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
        // partial JSON — ignore, will be completed next chunk
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
