import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveWebhookUrl } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// PATCH — update secret / filterExpr / inputTemplate / enabled.
// We never re-expose the secret once set — only whether one exists.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; triggerId: string }> }) {
  const { triggerId } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.webhookTrigger.findUnique({ where: { id: triggerId } });
  if (!existing) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.filterExpr !== undefined) data.filterExpr = (body.filterExpr as string).slice(0, 1000);
  if (body.inputTemplate !== undefined) data.inputTemplate = (body.inputTemplate as string).slice(0, 4000);
  if (body.secret !== undefined) {
    // Empty string clears the secret; otherwise update it.
    data.secret = (body.secret as string).slice(0, 500);
  }

  const updated = await db.webhookTrigger.update({ where: { id: triggerId }, data });

  return NextResponse.json({
    id: updated.id,
    agentId: updated.agentId,
    token: updated.token,
    hasSecret: !!updated.secret,
    secret: updated.secret ? "••••••" : "",
    filterExpr: updated.filterExpr,
    inputTemplate: updated.inputTemplate,
    enabled: updated.enabled,
    lastTriggeredAt: updated.lastTriggeredAt instanceof Date ? updated.lastTriggeredAt.toISOString() : updated.lastTriggeredAt,
    triggerCount: updated.triggerCount,
    webhookUrl: deriveWebhookUrl(req.headers, updated.token),
    createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
  });
}

// DELETE — remove a webhook trigger
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; triggerId: string }> }) {
  const { triggerId } = await params;
  await db.webhookTrigger.delete({ where: { id: triggerId } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
