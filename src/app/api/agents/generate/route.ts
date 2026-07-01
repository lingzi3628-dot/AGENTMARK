import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TEMPLATES, NODE_PALETTE, TOOLS } from "@/lib/constants";
import type { WorkflowNode, WorkflowEdge, NodeKind, ToolType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are an expert at designing AI agent workflows for AGENTMARK, a visual agent builder.
Given a user's description, design a complete workflow as JSON.

CRITICAL RULES — the generated workflow MUST follow these node rules:

## Available Node Kinds (14 types):
1. trigger: Entry point (user input). EXACTLY ONE per workflow. Fields: { kind: "trigger", label: "Input", content: "User message" }
2. model: LLM generation node. Fields: { kind: "model", label, provider: "free-openai"|"glm-4.6"|"glm-4.5-air", systemPrompt: "detailed instructions", temperature: 0.7 }
3. tool: Action/capability node. Fields: { kind: "tool", label, tool: "<tool-type>" }
4. knowledge: Context injection. Fields: { kind: "knowledge", label, content: "context text", useRAG: false }
5. memory: Save/recall across runs. Fields: { kind: "memory", label, memoryKey: "key-name", memoryMode: "save"|"load"|"both" }
6. router: Conditional branching. Fields: { kind: "router", label, routerConditions: [{keyword: "word", targetNodeId: "node-id"}], routerDefault: "node-id" }
7. code: Custom JavaScript. Fields: { kind: "code", label, code: "return input.toUpperCase();", codeTimeout: 5000 }
8. python: Custom Python (numpy, pandas). Fields: { kind: "python", label, pythonCode: "result = input.upper()", pythonTimeout: 30000 }
9. approval: Human-in-the-loop. Fields: { kind: "approval", label, approvalMessage: "Please review", approvalTimeoutHours: 168 }
10. sub-agent: Call another agent. Fields: { kind: "sub-agent", label, subAgentId: "", subAgentInputTemplate: "{{input}}" }
11. image-gen: AI image generation. Fields: { kind: "image-gen", label, imageSize: "1024x1024" }
12. vision: Image understanding. Fields: { kind: "vision", label }
13. output: Final result. EXACTLY ONE per workflow. Fields: { kind: "output", label: "Response" }

## Available Tool Types (18 tools):
AI-powered: web-search, page-reader, http-request, summarize, translate, code, classify, tts
Local (no API): text-extract, json-transform, regex-match, markdown-convert, hash-generate, base64-codec, url-codec, diff-text, csv-parser, uuid-generate

## Edge Rules:
- Every node (except trigger) MUST have at least one incoming edge
- Every node (except output) MUST have at least one outgoing edge
- Edges form a DAG (no cycles)
- Edge format: { id: "e-1-2", source: "node-id", target: "node-id", animated: true }

## Position Rules:
- Left-to-right flow: x increases by ~320px per level
- Trigger at x=80, y=240
- Output at the rightmost position
- Stagger y values ±80px for parallel nodes

## Provider Rules:
- Use "free-openai" for general tasks (default, no API key needed)
- Use "glm-4.5-air" for fast/simple tasks
- Use "glm-4.6" for complex reasoning (requires API key)

## System Prompt Rules (for model nodes):
- Write DETAILED system prompts that explain exactly what the model should do
- Include the agent's role, tone, and output format
- Example: "You are a customer support agent. Be empathetic and professional. Acknowledge the customer's concern, then provide clear step-by-step instructions. Keep responses under 200 words."

## Output Format:
Output ONLY valid JSON (no markdown, no explanation):
{
  "name": "short agent name (2-4 words)",
  "description": "one sentence describing what this agent does",
  "icon": "sparkles|bot|brain|code|pen-tool|search|file-text|languages|database|rocket|lightbulb|wand-2",
  "category": "productivity|engineering|research|content|support|custom",
  "nodes": [
    { "id": "trigger-1", "type": "agent", "position": {"x": 80, "y": 240}, "data": {"kind": "trigger", "label": "Input", "content": "User message"} },
    { "id": "model-1", "type": "agent", "position": {"x": 400, "y": 240}, "data": {"kind": "model", "label": "AI Model", "provider": "free-openai", "systemPrompt": "You are...", "temperature": 0.7} },
    { "id": "output-1", "type": "agent", "position": {"x": 720, "y": 240}, "data": {"kind": "output", "label": "Response"} }
  ],
  "edges": [
    { "id": "e-trigger-1-model-1", "source": "trigger-1", "target": "model-1", "animated": true },
    { "id": "e-model-1-output-1", "source": "model-1", "target": "output-1", "animated": true }
  ]
}

VALIDATION CHECKLIST (verify before outputting):
✓ Exactly ONE trigger node (kind: "trigger")
✓ Exactly ONE output node (kind: "output")
✓ All nodes have valid kind values from the list above
✓ All edges connect valid node IDs
✓ No orphan nodes (every non-trigger has incoming, every non-output has outgoing)
✓ Model nodes have systemPrompt field
✓ Tool nodes have valid tool type
✓ Positions are left-to-right
✓ 3-7 nodes total (keep it practical)
✓ Node IDs are unique
✓ Edge IDs are unique`;

const REFINE_INSTRUCTION = `

IMPORTANT: You are REFINING an existing workflow. Return the FULL updated workflow JSON (not just the changes).
Apply the user's feedback while keeping the overall structure. Follow all node rules:
- Exactly one trigger + one output
- All nodes properly connected with edges
- Valid node kinds and tool types
- Detailed system prompts for model nodes
- Left-to-right positioning

Return ONLY the complete updated JSON workflow.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const description = (body.description as string)?.trim();
  const history = body.history as HistoryMessage[] | undefined;
  const refine = body.refine as boolean | undefined;

  if (!description && !refine) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  try {
    let raw = "";
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(history || []).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: "user" as const,
            content: refine
              ? `REFINE REQUEST: ${description}\n\n${REFINE_INSTRUCTION}`
              : `Design an agent for: ${description}`,
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      raw = data?.choices?.[0]?.message?.content ?? "";
    }

    // Extract JSON from the response (handle markdown code fences)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not generate a valid workflow", raw }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      name: string;
      description: string;
      icon: string;
      category: string;
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
    };

    // === VALIDATION ===
    const errors = validateWorkflow(parsed);
    if (errors.length > 0) {
      // Try to auto-fix common issues
      const fixed = autoFixWorkflow(parsed);
      return NextResponse.json({ ...fixed, _fallback: false, _warnings: errors });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    const fallback = buildFallback(description || "Custom Agent");
    return NextResponse.json({ ...fallback, _fallback: true, _error: msg });
  }
}

/**
 * Validate the generated workflow against node rules.
 */
function validateWorkflow(wf: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): string[] {
  const errors: string[] = [];
  const validKinds: NodeKind[] = [
    "trigger", "model", "tool", "knowledge", "memory", "router",
    "code", "python", "approval", "sub-agent", "image-gen", "vision", "output",
  ];
  const validTools: ToolType[] = [
    "web-search", "page-reader", "http-request", "summarize", "translate",
    "code", "classify", "tts", "text-extract", "json-transform", "regex-match",
    "markdown-convert", "hash-generate", "base64-codec", "url-codec", "diff-text",
    "csv-parser", "uuid-generate",
  ];

  // Check exactly one trigger
  const triggers = wf.nodes.filter((n) => n.data?.kind === "trigger");
  if (triggers.length === 0) errors.push("Missing trigger node");
  if (triggers.length > 1) errors.push("Multiple trigger nodes (should be exactly 1)");

  // Check exactly one output
  const outputs = wf.nodes.filter((n) => n.data?.kind === "output");
  if (outputs.length === 0) errors.push("Missing output node");
  if (outputs.length > 1) errors.push("Multiple output nodes (should be exactly 1)");

  // Check valid node kinds
  for (const node of wf.nodes) {
    if (!node.data?.kind || !validKinds.includes(node.data.kind)) {
      errors.push(`Invalid node kind: ${node.data?.kind} on node ${node.id}`);
    }
    if (node.data?.kind === "tool" && node.data.tool && !validTools.includes(node.data.tool)) {
      errors.push(`Invalid tool type: ${node.data.tool} on node ${node.id}`);
    }
  }

  // Check edges reference valid nodes
  const nodeIds = new Set(wf.nodes.map((n) => n.id));
  for (const edge of wf.edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} references unknown source: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} references unknown target: ${edge.target}`);
  }

  // Check no orphan nodes (every non-trigger has incoming, every non-output has outgoing)
  const incomingMap = new Map<string, number>();
  const outgoingMap = new Map<string, number>();
  for (const node of wf.nodes) {
    incomingMap.set(node.id, 0);
    outgoingMap.set(node.id, 0);
  }
  for (const edge of wf.edges) {
    incomingMap.set(edge.target, (incomingMap.get(edge.target) ?? 0) + 1);
    outgoingMap.set(edge.source, (outgoingMap.get(edge.source) ?? 0) + 1);
  }
  for (const node of wf.nodes) {
    if (node.data?.kind !== "trigger" && (incomingMap.get(node.id) ?? 0) === 0) {
      errors.push(`Node ${node.id} (${node.data?.label}) has no incoming edges`);
    }
    if (node.data?.kind !== "output" && (outgoingMap.get(node.id) ?? 0) === 0) {
      errors.push(`Node ${node.id} (${node.data?.label}) has no outgoing edges`);
    }
  }

  return errors;
}

/**
 * Auto-fix common workflow issues.
 */
function autoFixWorkflow(wf: { name: string; description: string; icon: string; category: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }) {
  // Ensure trigger exists
  if (!wf.nodes.find((n) => n.data?.kind === "trigger")) {
    wf.nodes.unshift({
      id: "trigger-1",
      type: "agent",
      position: { x: 80, y: 240 },
      data: { kind: "trigger", label: "Input", content: "User message" },
    });
  }

  // Ensure output exists
  if (!wf.nodes.find((n) => n.data?.kind === "output")) {
    const lastNode = wf.nodes[wf.nodes.length - 1];
    wf.nodes.push({
      id: "output-1",
      type: "agent",
      position: { x: (lastNode?.position?.x ?? 400) + 320, y: 240 },
      data: { kind: "output", label: "Response" },
    });
    if (lastNode) {
      wf.edges.push({
        id: `e-${lastNode.id}-output-1`,
        source: lastNode.id,
        target: "output-1",
        animated: true,
      });
    }
  }

  // Fix orphan nodes — connect to nearest neighbor
  const nodeIds = wf.nodes.map((n) => n.id);
  for (let i = 0; i < wf.nodes.length - 1; i++) {
    const current = wf.nodes[i];
    const next = wf.nodes[i + 1];
    const hasOutgoing = wf.edges.some((e) => e.source === current.id);
    if (!hasOutgoing && current.data?.kind !== "output") {
      wf.edges.push({
        id: `e-${current.id}-${next.id}`,
        source: current.id,
        target: next.id,
        animated: true,
      });
    }
  }

  return wf;
}

function buildFallback(desc: string) {
  const tpl = DEFAULT_TEMPLATES[0];
  return {
    name: desc.slice(0, 40) || "Custom Agent",
    description: desc.slice(0, 120),
    icon: "sparkles",
    category: "custom",
    nodes: tpl.nodes.map((n) => ({ ...n, id: `${n.id}-${Date.now()}` })),
    edges: tpl.edges.map((e) => ({
      ...e,
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    })),
  };
}
