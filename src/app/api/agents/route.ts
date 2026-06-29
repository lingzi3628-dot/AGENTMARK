import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";
import { DEFAULT_TEMPLATES } from "@/lib/constants";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.agent.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(rows.map(toAgent));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim() || "Untitled Agent";
  const description = (body.description as string)?.trim() || "";
  const icon = body.icon || "sparkles";
  const category = body.category || "custom";
  const nodes: WorkflowNode[] = body.nodes ?? defaultNodes();
  const edges: WorkflowEdge[] = body.edges ?? defaultEdges();

  // Check max agents limit if user is authenticated
  const firebaseUid = body.firebaseUid as string | undefined;
  let userId: string | undefined;
  if (firebaseUid) {
    const user = await db.user.findUnique({ where: { firebaseUid } });
    if (user) {
      userId = user.id;
      const count = await db.agent.count({ where: { userId } });
      if (count >= user.maxAgents) {
        return NextResponse.json(
          { error: `Agent limit reached (${user.maxAgents}). Delete unused agents or upgrade your plan.` },
          { status: 429 },
        );
      }
    }
  }

  // Optionally seed from a template
  const templateId = body.templateId as string | undefined;
  let tplNodes = nodes;
  let tplEdges = edges;
  if (templateId) {
    const tpl = await db.template.findUnique({ where: { id: templateId } });
    if (tpl) {
      tplNodes = JSON.parse(tpl.nodes);
      tplEdges = JSON.parse(tpl.edges);
      await db.template.update({
        where: { id: templateId },
        data: { installs: { increment: 1 } },
      }).catch(() => undefined);
    }
  }

  const created = await db.agent.create({
    data: {
      name,
      description,
      icon,
      category,
      nodes: JSON.stringify(tplNodes),
      edges: JSON.stringify(tplEdges),
      ...(userId ? { userId } : {}),
    },
  });
  return NextResponse.json(toAgent(created), { status: 201 });
}

function defaultNodes(): WorkflowNode[] {
  return [
    { id: "trigger-1", type: "agent", position: { x: 80, y: 240 }, data: { label: "Input", kind: "trigger", content: "User message" } },
    { id: "model-1", type: "agent", position: { x: 400, y: 240 }, data: { label: "GLM Model", kind: "model", provider: "glm-4.5-air", systemPrompt: "You are a helpful AI agent. Respond clearly and concisely." } },
    { id: "output-1", type: "agent", position: { x: 720, y: 240 }, data: { label: "Response", kind: "output" } },
  ];
}
function defaultEdges(): WorkflowEdge[] {
  return [
    { id: "e-trigger-1-model-1", source: "trigger-1", target: "model-1", animated: true },
    { id: "e-model-1-output-1", source: "model-1", target: "output-1", animated: true },
  ];
}

// re-export for seed usage
export { DEFAULT_TEMPLATES };
