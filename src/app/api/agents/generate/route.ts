import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { DEFAULT_TEMPLATES } from "@/lib/constants";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert at designing AI agent workflows for AGENTMARK, a visual agent builder.
Given a user's description, design a complete workflow as JSON.

Available node kinds:
- trigger: entry point (user input). Always exactly one.
- model: LLM generation. Fields: provider (glm-4.6, glm-4.5, glm-4.5-air, glm-4.5v), systemPrompt, label
- tool: action. Fields: tool (web-search, page-reader, http-request, summarize, translate, code, classify, tts), label
- knowledge: context injection. Fields: content, label
- memory: save/recall across runs. Fields: memoryKey, memoryMode (save|load|both), label
- router: conditional branching. Fields: routerConditions [{keyword, targetNodeId}], routerDefault, label
- image-gen: image generation. Fields: imageSize (1024x1024), label
- vision: image understanding. Fields: label
- output: final result. Always exactly one.

Output ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "name": "short agent name",
  "description": "one sentence",
  "icon": "sparkles",
  "category": "productivity",
  "nodes": [
    { "id": "trigger-1", "type": "agent", "position": {"x": 0, "y": 200}, "data": {"kind": "trigger", "label": "Input", "content": "User message"} },
    ...
  ],
  "edges": [
    { "id": "e-1-2", "source": "trigger-1", "target": "model-1", "animated": true }
  ]
}

Rules:
- Always include exactly one trigger and one output node.
- Connect nodes with edges to form a DAG (no cycles).
- Use 3-7 nodes total. Keep it practical.
- Pick the best model per task (glm-4.6 for complex reasoning, glm-4.5-air for simple/fast).
- Position nodes left-to-right with ~320px horizontal spacing, staggered vertically.
- Choose an icon from: sparkles, bot, brain, code, pen-tool, search, file-text, languages, database, rocket, lightbulb, wand-2
- Choose category from: productivity, engineering, research, content, support, custom`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const description = (body.description as string)?.trim();
  if (!description) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  try {
    // Try the SDK first, then fall back to free API
    let raw = "";
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: "glm-4.6",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Design an agent for: ${description}` },
        ],
        thinking: { type: "disabled" },
      });
      raw = completion?.choices?.[0]?.message?.content ?? "";
    } catch {
      // Free API fallback (no key required) — AGENTMARK Free
      const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Design an agent for: ${description}` },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        raw = data?.choices?.[0]?.message?.content ?? "";
      }
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

    // Validate structure
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return NextResponse.json({ error: "Invalid workflow structure" }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    // Fallback: use a simple template based on keywords
    const fallback = buildFallback(description);
    return NextResponse.json({ ...fallback, _fallback: true, _error: msg });
  }
}

function buildFallback(desc: string) {
  const tpl = DEFAULT_TEMPLATES[0]; // Research Assistant
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
