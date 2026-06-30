import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteTelegramWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const existing = await db.integration.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await db.integration.update({
    where: { id },
    data: {
      enabled: body.enabled ?? existing.enabled,
      config: body.config ? JSON.stringify(body.config) : existing.config,
    },
  });
  return NextResponse.json({ ok: true, enabled: updated.enabled });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Clean up platform-side webhook before deleting
  const integ = await db.integration.findUnique({ where: { id } });
  if (integ?.platform === "telegram") {
    try {
      const cfg = JSON.parse(integ.config) as Record<string, string>;
      if (cfg.botToken) await deleteTelegramWebhook(cfg.botToken);
    } catch {
      // ignore
    }
  }
  await db.integration.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
