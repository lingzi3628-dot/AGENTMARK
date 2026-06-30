import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateWebhookToken, deriveWebhookUrl } from "@/lib/webhook";

export const dynamic = "force-dynamic";

const MAX_TRIGGERS_PER_AGENT = 5;

// List webhook triggers for an agent
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.webhookTrigger.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      token: r.token,
      // We never expose the secret once set — just whether one exists.
      hasSecret: !!r.secret,
      secret: r.secret ? "••••••" : "",
      filterExpr: r.filterExpr,
      inputTemplate: r.inputTemplate,
      enabled: r.enabled,
      lastTriggeredAt:
        r.lastTriggeredAt instanceof Date ? r.lastTriggeredAt.toISOString() : r.lastTriggeredAt,
      triggerCount: r.triggerCount,
      webhookUrl: deriveWebhookUrl(req.headers, r.token),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  );
}

// Create a new webhook trigger — returns the token (and URL) once.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const existing = await db.webhookTrigger.count({ where: { agentId: id } });
  if (existing >= MAX_TRIGGERS_PER_AGENT) {
    return NextResponse.json(
      { error: `Webhook trigger limit reached (${MAX_TRIGGERS_PER_AGENT} per agent).` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const secret = (body.secret as string)?.trim() || "";
  const filterExpr = (body.filterExpr as string)?.trim() || "";
  const inputTemplate =
    (body.inputTemplate as string)?.trim() || "{{payload}}";
  const enabled = body.enabled !== false; // default true

  const token = generateWebhookToken();

  const created = await db.webhookTrigger.create({
    data: {
      agentId: id,
      token,
      secret,
      filterExpr,
      inputTemplate,
      enabled,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      agentId: created.agentId,
      token: created.token,
      hasSecret: !!created.secret,
      secret: created.secret ? "••••••" : "",
      filterExpr: created.filterExpr,
      inputTemplate: created.inputTemplate,
      enabled: created.enabled,
      lastTriggeredAt: created.lastTriggeredAt instanceof Date ? created.lastTriggeredAt.toISOString() : created.lastTriggeredAt,
      triggerCount: created.triggerCount,
      webhookUrl: deriveWebhookUrl(req.headers, created.token),
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : created.createdAt,
    },
    { status: 201 },
  );
}
