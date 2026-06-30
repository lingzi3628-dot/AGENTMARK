import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an expert at analyzing AI agent workflows for AGENTMARK, a visual agent builder.
Given a workflow's nodes and edges as JSON, analyze it and return improvement suggestions.

For each suggestion, classify by:
- type: "cost" (cheaper model/option) | "latency" (faster execution) | "reliability" (error handling, retries) | "best-practice" (better prompts, structure)
- severity: "low" | "medium" | "high"
- title: short actionable title
- description: 1-2 sentence explanation
- nodeId: the node id this applies to (or "" if general)
- estimatedSavings: e.g. "$0.02/run" or "30% faster" or "" if not quantifiable

Also provide:
- overallScore: 0-100 (how well-optimized is this workflow)
- summary: 1-2 sentence overall assessment

Output ONLY valid JSON (no markdown, no explanation):
{
  "suggestions": [
    { "type": "cost", "severity": "medium", "title": "...", "description": "...", "nodeId": "...", "estimatedSavings": "..." }
  ],
  "overallScore": 78,
  "summary": "..."
}

Common suggestions to look for:
- Using expensive models (glm-4.6) for simple tasks that glm-4.5-air could handle
- Missing error handling or retry logic
- System prompts that are too vague or too long
- Missing knowledge/context nodes where they'd help
- Unnecessary nodes that could be removed
- Missing approval steps for sensitive operations
- Inefficient node ordering or redundant processing`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const nodes = JSON.parse(agent.nodes || "[]");
  const edges = JSON.parse(agent.edges || "[]");

  // Build a simplified representation for the AI
  const workflowSummary = {
    agentName: agent.name,
    description: agent.description,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map((n: { id: string; data: { kind: string; label: string; provider?: string; systemPrompt?: string; tool?: string } }) => ({
      id: n.id,
      kind: n.data?.kind,
      label: n.data?.label,
      provider: n.data?.provider,
      tool: n.data?.tool,
      promptLength: n.data?.systemPrompt?.length || 0,
    })),
    edges: edges.map((e: { source: string; target: string }) => ({ from: e.source, to: e.target })),
  };

  try {
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this workflow:\n\n${JSON.stringify(workflowSummary, null, 2)}` },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI analysis failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        suggestions: [],
        overallScore: 50,
        summary: "Could not parse AI response. Try again.",
      });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestions?: unknown[];
      overallScore?: number;
      summary?: string;
    };

    return NextResponse.json({
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 50,
      summary: parsed.summary || "Analysis complete.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
