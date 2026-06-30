import ZAI from "z-ai-web-dev-sdk";
import { promises as fs } from "fs";
import path from "path";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from "./types";
import { db } from "./db";
import { retrieveContext, formatRetrievedChunks } from "./rag";
import { runSandboxed } from "./sandbox";
import { withRetry, isRetryableError } from "./retry";
import { recordNodeMetric } from "./node-metrics";

// Maximum sub-agent recursion depth. The top-level call is depth 0; sub-agents
// can recurse up to MAX_SUB_AGENT_DEPTH times before the runtime refuses to go
// deeper. Prevents accidental infinite loops when agents reference each other.
const MAX_SUB_AGENT_DEPTH = 3;

// Singleton ZAI client
let _zai: ZAI | null = null;
let _triedInit = false;

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

export async function getZAI(): Promise<ZAI | null> {
  // Always return null — we use the direct HTTP fallback (free API) exclusively.
  // The SDK requires a config file that doesn't exist on Railway/production.
  // If ZAI_BASE_URL + ZAI_API_KEY env vars are set, directCompletion will use GLM.
  return null;
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
  // V2 cost tracking — broken-down token counts + the provider that drove
  // the terminal generation. Consumed by /api/agents/[id]/run to compute
  // cost via calculateCost(provider, inputTokens, outputTokens).
  inputTokens?: number;
  outputTokens?: number;
  provider?: string;
  duration?: number;
  message?: string;
}

export interface ExecContext {
  input: string;
  history: { role: "user" | "assistant"; content: string }[];
  // Agent ID — required for RAG (semantic retrieval over uploaded docs).
  // Optional so existing callers (e.g. public run, webhooks) keep working.
  agentId?: string;
  // Sub-agent recursion depth — 0 at the top level, +1 for each nested call.
  // The executor refuses to recurse beyond MAX_SUB_AGENT_DEPTH.
  depth?: number;
  // Chain of agent IDs that led to this call. Used to short-circuit cycles
  // (an agent calling itself, directly or transitively, more than the depth
  // cap allows).
  callStack?: string[];
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
  const depth = ctx.depth ?? 0;
  const callStack = ctx.callStack ?? (ctx.agentId ? [ctx.agentId] : []);
  const started = Date.now();
  const order = topoSort(nodes, edges);
  const outputs = new Map<string, string>();
  // getZAI() returns null if the SDK config isn't available (e.g. on Railway
  // without ZAI_API_KEY). runCompletion/streamCompletion handle null by
  // falling back to the free API via directCompletion/directStream.
  const zai = await getZAI();

  // upstream outputs for a node
  const upstream = (id: string) =>
    edges
      .filter((e) => e.target === id)
      .map((e) => outputs.get(e.source))
      .filter(Boolean) as string[];

  const incomingContext = (id: string) => upstream(id).join("\n\n---\n\n") || ctx.input;

  // Determine the terminal generation node (the one feeding an output node, else last generation-capable node)
  const genKinds = ["model", "tool", "vision", "image-gen", "memory", "router", "code", "sub-agent"];
  const outputNode = nodes.find((n) => n.data.kind === "output");
  const terminalGenId = outputNode
    ? (edges.find((e) => e.target === outputNode.id)?.source ??
        [...order].reverse().find((n) => genKinds.includes(n.data.kind))?.id)
    : [...order].reverse().find((n) => genKinds.includes(n.data.kind))?.id;

  let totalTokens = 0;
  // V2 cost tracking: input vs output token split + the provider that drove
  // the terminal generation node. Used by /api/agents/[id]/run to compute
  // USD cost via calculateCost(provider, inputTokens, outputTokens).
  let inputTokens = 0;
  let outputTokens = 0;
  // The provider of the terminal model node — defaults to free-openai so
  // unknown graphs still produce a $0 cost (free-* models cost nothing).
  let primaryProvider: string = "free-openai";
  if (terminalGenId) {
    const termNode = nodes.find((n) => n.id === terminalGenId);
    if (termNode?.data.provider) primaryProvider = termNode.data.provider;
  }

  // Helper: rough input-token estimate for an LLM call. Uses the standard
  // ~4 chars/token heuristic, includes the system prompt + user context +
  // recent history. Capped to avoid runaway counts on huge inputs.
  const estimateInput = (sys: string, userCtx: string) => {
    const histChars = ctx.history.slice(-6).reduce((s, h) => s + h.content.length, 0);
    return Math.ceil(Math.min(8000, (sys.length + userCtx.length + histChars) / 4));
  };

  for (const node of order) {
    const data = node.data;
    const label = data.label || data.kind;
    const nodeStartedAt = Date.now();
    yield { type: "trace", node: node.id, label, status: "running" };

    try {
      if (data.kind === "trigger") {
        outputs.set(node.id, ctx.input);
      } else if (data.kind === "knowledge") {
        // RAG: if useRAG=true, embed the upstream context and retrieve the
        // top-K most similar chunks from this agent's document store.
        // Prepend retrieved chunks to the node's content (if any).
        if (data.useRAG && ctx.agentId) {
          const query = incomingContext(node.id) || ctx.input;
          const topK = Math.max(1, Math.min(10, data.ragTopK ?? 4));
          try {
            const chunks = await retrieveContext(ctx.agentId, query, topK);
            const retrieved = formatRetrievedChunks(chunks);
            const base = data.content ? data.content.trim() : "";
            const merged = retrieved
              ? (base ? `${retrieved}\n\n---\n\n${base}` : retrieved)
              : base || "No RAG matches found.";
            outputs.set(node.id, merged);
            if (chunks.length > 0) {
              yield {
                type: "trace",
                node: node.id,
                label: `${label}: retrieved ${chunks.length} chunk${chunks.length > 1 ? "s" : ""}`,
                status: "streaming",
              };
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "RAG failed";
            outputs.set(node.id, `[RAG error: ${msg}]\n\n${data.content ?? ""}`.trim());
            yield { type: "trace", node: node.id, label: `${label}: RAG error`, status: "error" };
          }
        } else {
          const text = data.content || "Knowledge context.";
          outputs.set(node.id, text);
        }
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
            // Smart retry on transient HTTP failures (5xx, timeouts, network errors)
            const result = await withRetry(
              async () => {
                const res = await fetch(url, {
                  method,
                  headers,
                  body: method === "POST" ? (data.httpBody ?? undefined) : undefined,
                });
                if (!res.ok && res.status >= 500) {
                  throw new Error(`HTTP ${res.status}`);
                }
                const text = await res.text();
                return { status: res.status, text };
              },
              { maxRetries: 2 },
            );
            const trimmed = result.text.slice(0, 4000);
            outputs.set(node.id, `HTTP ${method} ${url} → ${result.status}\n\n${trimmed}`);
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
      } else if (data.kind === "code") {
        // Run user-supplied JS in a locked-down vm sandbox.
        const code = (data.code ?? "").trim();
        if (!code) {
          outputs.set(node.id, "[code: empty — write JS in the inspector]");
        } else {
          const sandboxInput = incomingContext(node.id);
          const timeout = Math.min(Math.max(data.codeTimeout ?? 5000, 1000), 30000);
          const result = await runSandboxed(code, sandboxInput, ctx.history, timeout);
          // Surface captured console logs as deltas so the user can see them.
          for (const line of result.consoleLogs) {
            yield { type: "delta", content: `\n[code] ${line}\n` };
          }
          if (result.ok) {
            const out = result.output ?? "";
            outputs.set(node.id, out);
            totalTokens += Math.ceil(out.length / 4);
          } else {
            // Sandbox failed — record the error and stop the run.
            const errMsg = result.error ?? "unknown code error";
            outputs.set(node.id, `[code error: ${errMsg}]`);
            yield { type: "trace", node: node.id, label, status: "error" };
            yield { type: "error", node: node.id, message: `Code node "${label}" failed: ${errMsg}` };
            return;
          }
        }
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
      } else if (data.kind === "sub-agent") {
        // Invoke another agent's full graph as part of this workflow.
        const subAgentId = data.subAgentId?.trim();
        const incoming = incomingContext(node.id);
        const template = data.subAgentInputTemplate ?? "{{input}}";
        const subInput = template
          ? template.replace(/\{\{input\}\}/g, incoming.slice(0, 4000))
          : incoming;

        if (!subAgentId) {
          // No agent selected — pass through upstream unchanged.
          outputs.set(node.id, incoming);
          yield {
            type: "trace",
            node: node.id,
            label: `${label}: no sub-agent configured`,
            status: "streaming",
          };
        } else if (depth >= MAX_SUB_AGENT_DEPTH) {
          // Recursion cap — refuse to go deeper.
          outputs.set(
            node.id,
            `[sub-agent: max recursion depth (${MAX_SUB_AGENT_DEPTH}) reached — refusing to call ${subAgentId}]`,
          );
          yield {
            type: "trace",
            node: node.id,
            label: `${label}: recursion cap hit (depth=${depth})`,
            status: "streaming",
          };
        } else if (callStack.includes(subAgentId)) {
          // Cycle detection — the same agent appears earlier in the call chain.
          outputs.set(
            node.id,
            `[sub-agent: cycle detected — agent ${subAgentId} is already in the call stack]`,
          );
          yield {
            type: "trace",
            node: node.id,
            label: `${label}: cycle detected`,
            status: "streaming",
          };
        } else {
          // Load the sub-agent from the database and parse its graph.
          const subAgent = await db.agent
            .findUnique({ where: { id: subAgentId } })
            .catch(() => null);
          if (!subAgent) {
            outputs.set(node.id, `[sub-agent: agent ${subAgentId} not found]`);
          } else {
            let subNodes: WorkflowNode[] = [];
            let subEdges: WorkflowEdge[] = [];
            try {
              subNodes = JSON.parse(subAgent.nodes) as WorkflowNode[];
              subEdges = JSON.parse(subAgent.edges) as WorkflowEdge[];
            } catch {
              outputs.set(
                node.id,
                `[sub-agent: failed to parse graph for ${subAgent.name}]`,
              );
            }

            if (subNodes.length > 0) {
              // Surface the sub-agent's name in a trace event so the run view
              // can show "Calling Sub-Agent X" before it starts.
              yield {
                type: "trace",
                node: node.id,
                label: `${label}: calling "${subAgent.name}"`,
                status: "streaming",
              };
              // Recursively execute the sub-agent graph. We pass the rendered
              // input template as the new trigger input, carry history
              // forward, and bump the recursion depth + call stack.
              let subFinalOutput = "";
              let subTokens = 0;
              for await (const ev of executeAgent(subNodes, subEdges, {
                input: subInput || ctx.input,
                history: ctx.history,
                agentId: subAgent.id,
                depth: depth + 1,
                callStack: [...callStack, subAgent.id],
              })) {
                if (ev.type === "done") {
                  subFinalOutput = ev.output ?? "";
                  subTokens = ev.tokens ?? 0;
                  // Roll sub-agent cost into parent so the parent /run
                  // endpoint can bill once for the whole call tree.
                  inputTokens += ev.inputTokens ?? 0;
                  outputTokens += ev.outputTokens ?? 0;
                  // If the parent has no provider yet (e.g. its terminal
                  // node isn't a model), inherit the sub-agent's provider.
                  if (primaryProvider === "free-openai" && ev.provider) {
                    primaryProvider = ev.provider;
                  }
                }
                // Sub-agent trace/delta events are intentionally NOT
                // forwarded — they would clutter the parent run view. The
                // parent's trace events above are enough to indicate
                // progress.
              }
              outputs.set(node.id, subFinalOutput || "(sub-agent returned no output)");
              totalTokens += subTokens;
            }
          }
        }
      } else if (data.kind === "approval") {
        // Human-in-the-loop: pause the workflow until someone approves or
        // rejects (or it auto-expires). The upstream context becomes the
        // payload the approver sees. We persist an Approval row, emit a
        // WAITING trace, then poll the DB every 5s for up to 10 minutes.
        const incoming = incomingContext(node.id);
        const timeoutHours = Math.max(1, Math.min(720, data.approvalTimeoutHours ?? 168));
        const expiresAt = new Date(Date.now() + timeoutHours * 3600 * 1000);
        const runId =
          (ctx.agentId ?? "agent") + "-" + Date.now().toString(36) + "-" +
          Math.random().toString(36).slice(2, 8);

        const approval = await db.approval.create({
          data: {
            agentId: ctx.agentId ?? "",
            runId,
            nodeId: node.id,
            context: incoming.slice(0, 12000),
            status: "pending",
            expiresAt,
          },
        });

        // Surface the approval request to any client listening to the SSE
        // stream (the run view shows it as a "waiting for approval" step).
        yield {
          type: "trace",
          node: node.id,
          label: `${label}: waiting for approval`,
          status: "WAITING",
          message: data.approvalMessage || "Approval required",
        };

        // Poll every 5 seconds for up to 10 minutes (120 polls). On each
        // tick we re-read the row to check if status has changed or the
        // expiry has passed. A terminal decision breaks the loop.
        const POLL_INTERVAL_MS = 5000;
        const MAX_POLLS = 120;
        let decision: "approved" | "rejected" | "expired" | "pending" = "pending";
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const row = await db.approval
            .findUnique({ where: { id: approval.id } })
            .catch(() => null);
          if (!row) {
            decision = "expired";
            break;
          }
          if (row.status === "approved" || row.status === "rejected") {
            decision = row.status;
            break;
          }
          // Auto-expire if the window has elapsed — mark the row so the
          // Approvals UI shows it as expired rather than pending.
          if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
            await db.approval
              .update({ where: { id: row.id }, data: { status: "expired" } })
              .catch(() => undefined);
            decision = "expired";
            break;
          }
        }

        if (decision === "approved") {
          outputs.set(node.id, incoming);
          yield {
            type: "trace",
            node: node.id,
            label: `${label}: approved`,
            status: "streaming",
          };
        } else {
          // Rejected or expired — stop the workflow with an error event so
          // the run view + history surface the failure clearly.
          const reason = decision === "expired" ? "expired (no decision)" : "rejected";
          outputs.set(node.id, `[approval ${reason}]`);
          yield {
            type: "trace",
            node: node.id,
            label: `${label}: ${reason}`,
            status: "error",
          };
          yield {
            type: "error",
            node: node.id,
            message: `Approval node "${label}" ${reason}. Workflow stopped.`,
          };
          return;
        }
      } else if (data.kind === "model") {
        const sys = data.systemPrompt || "You are a helpful AI agent.";
        const context = incomingContext(node.id);
        if (node.id === terminalGenId) {
          // Stream this one
          yield { type: "trace", node: node.id, label, status: "streaming" };
          // Track input tokens for the primary generation call.
          inputTokens += estimateInput(sys, context);
          let full = "";
          for await (const chunk of streamCompletion(zai, sys, context, data.provider, ctx.history, data)) {
            full += chunk;
            yield { type: "delta", content: chunk };
          }
          outputs.set(node.id, full);
          const out = Math.ceil(full.length / 4);
          totalTokens += out;
          outputTokens += out;
        } else {
          inputTokens += estimateInput(sys, context);
          const out = await runCompletion(zai, sys, context, data.provider, ctx.history, data);
          outputs.set(node.id, out);
          const outTok = Math.ceil(out.length / 4);
          totalTokens += outTok;
          outputTokens += outTok;
        }
      } else if (data.kind === "output") {
        const out = upstream(node.id).join("\n\n") || outputs.get(terminalGenId ?? "") || "";
        outputs.set(node.id, out);
      }
      yield { type: "trace", node: node.id, label, status: "done" };
      // Record successful node metric
      recordNodeMetric({
        nodeId: node.id,
        nodeLabel: label,
        nodeKind: data.kind,
        agentId: ctx.agentId || "",
        durationMs: Date.now() - nodeStartedAt,
        tokens: 0, // tokens are tracked separately at the run level
        status: "done",
        timestamp: nodeStartedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      outputs.set(node.id, `[error: ${msg}]`);
      yield { type: "trace", node: node.id, label, status: "error" };
      // Record failed node metric
      recordNodeMetric({
        nodeId: node.id,
        nodeLabel: label,
        nodeKind: data.kind,
        agentId: ctx.agentId || "",
        durationMs: Date.now() - nodeStartedAt,
        tokens: 0,
        status: "error",
        timestamp: nodeStartedAt,
      });
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
    inputTokens,
    outputTokens,
    provider: primaryProvider,
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

  // Custom model (user-provided API) — wrapped with retry
  if (model === "custom" && nodeData?.customApiUrl) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (nodeData.customApiKey) headers.authorization = `Bearer ${nodeData.customApiKey}`;
    return withRetry(
      async () => {
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
      },
      { maxRetries: 3 },
    );
  }

  const route = resolveModel(model);

  // GLM API (premium — needs env vars) — wrapped with retry
  if (route.type === "glm" && route.apiUrl && route.apiKey) {
    try {
      const content = await withRetry(
        async () => {
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
          if (!res.ok) throw new Error(`GLM API ${res.status}`);
          const data = await res.json();
          const c = data?.choices?.[0]?.message?.content;
          if (!c) throw new Error("GLM API empty response");
          return c;
        },
        { maxRetries: 2 },
      );
      if (content) return content;
    } catch {
      // fall through to free API
    }
  }

  // Free API (no key required) — default for all users.
  // Wrapped in smart retry with exponential backoff for transient failures.
  return withRetry(
    async () => {
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
    },
    { maxRetries: 3 },
  );
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
