import { NextRequest, NextResponse } from "next/server";
import type { WorkflowNode, WorkflowNodeData, NodeKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert at designing AI agent workflow nodes for AGENTMARK, a visual agent builder.
Given a user's description of a node idea, generate a complete node configuration as JSON.

Available node kinds:
- "model": LLM generation. Fields: provider (free-openai, glm-4.6, glm-4.5-air), systemPrompt, temperature
- "tool": action node. Fields: tool (web-search, page-reader, http-request, summarize, translate, code, classify, tts)
- "knowledge": context injection. Fields: content, useRAG
- "router": conditional branching. Fields: routerConditions [{keyword, targetNodeId}], routerDefault
- "memory": save/recall values. Fields: memoryKey, memoryMode (save|load|both)
- "code": custom JavaScript. Fields: code, codeTimeout
- "python": custom Python (numpy, pandas). Fields: pythonCode, pythonTimeout
- "approval": human-in-the-loop. Fields: approvalMessage, approvalTimeoutHours
- "sub-agent": call another agent. Fields: subAgentId
- "http-request" (as tool): Fields: httpMethod, httpUrl, httpHeaders, httpBody
- "image-gen": AI image generation. Fields: imageSize
- "vision": image understanding

Output ONLY valid JSON (no markdown, no explanation):
{
  "kind": "model",
  "label": "Short descriptive label",
  "description": "One sentence explaining what this node does",
  "data": {
    // Node-specific fields based on the kind
    "systemPrompt": "...",
    "provider": "free-openai",
    "temperature": 0.7
  }
}

Rules:
- Pick the most appropriate node kind for the user's idea
- Write a clear, concise systemPrompt if it's a model node
- Write working code if it's a code/python node
- Set sensible defaults for all fields
- Keep labels short (2-4 words)
- For model nodes, choose the best provider (free-openai for general, glm-4.6 for complex reasoning)
- For code nodes, write actual working JavaScript that uses 'input' and returns a value
- For python nodes, write actual working Python that uses 'input' and returns a value`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const description = (body.description as string)?.trim();

  if (!description) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  try {
    // Call the free AI API
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Design a node for: ${description}` },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    // Extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      kind: NodeKind;
      label: string;
      description: string;
      data: Partial<WorkflowNodeData>;
    };

    // Validate the node kind
    const validKinds: NodeKind[] = [
      "model", "tool", "knowledge", "router", "memory",
      "code", "python", "approval", "sub-agent", "image-gen", "vision", "trigger", "output",
    ];
    if (!validKinds.includes(parsed.kind)) {
      return NextResponse.json({ error: `Invalid node kind: ${parsed.kind}` }, { status: 422 });
    }

    // Build the complete node
    const nodeId = `${parsed.kind}-${Date.now()}`;
    const node: WorkflowNode = {
      id: nodeId,
      type: "agent",
      position: {
        x: 400 + Math.random() * 100,
        y: 200 + Math.random() * 100,
      },
      data: {
        kind: parsed.kind,
        label: parsed.label || "AI Generated Node",
        ...parsed.data,
      } as WorkflowNodeData,
    };

    return NextResponse.json({
      node,
      description: parsed.description,
      kind: parsed.kind,
      label: parsed.label,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
