import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setTelegramWebhook, deleteTelegramWebhook, getTelegramBotInfo, deriveWebhookUrl } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.integration.findMany({ where: { agentId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      platform: r.platform,
      config: safeParse(r.config),
      enabled: r.enabled,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const platform = body.platform as string;
  const config = body.config ?? {};
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  const created = await db.integration.create({
    data: { agentId: id, platform, config: JSON.stringify(config), enabled: true },
  });

  // Platform-specific auto-setup
  let setupStatus: { ok: boolean; message?: string } | undefined;

  if (platform === "telegram" && config.botToken) {
    try {
      // Validate the token first
      const info = await getTelegramBotInfo(config.botToken);
      if (!info.ok) {
        setupStatus = { ok: false, message: `Token invalid: ${info.error}` };
      } else {
        // Register the webhook with Telegram, including the integration ID
        // so the webhook knows which bot received each message.
        const webhookUrl = `${deriveWebhookUrl(req)}?i=${created.id}`;
        const registered = await setTelegramWebhook(config.botToken, webhookUrl);
        setupStatus = registered
          ? { ok: true, message: `Bot @${info.username} connected! Send it a message on Telegram to test.` }
          : { ok: false, message: "Token valid but webhook registration failed. Your server URL must be publicly accessible." };
      }
    } catch (e) {
      setupStatus = { ok: false, message: e instanceof Error ? e.message : "setup failed" };
    }
  }

  return NextResponse.json({
    id: created.id, agentId: created.agentId, platform: created.platform,
    config: safeParse(created.config), enabled: created.enabled,
    createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString(),
    setup: setupStatus,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Find integrations and clean up platform-side webhooks before deleting
  const integrations = await db.integration.findMany({ where: { agentId: id } });
  for (const integ of integrations) {
    if (integ.platform === "telegram") {
      const cfg = safeParse(integ.config);
      if (cfg.botToken) await deleteTelegramWebhook(cfg.botToken);
    }
  }
  await db.integration.deleteMany({ where: { agentId: id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

function safeParse(s: string): Record<string, string> {
  try { return JSON.parse(s) as Record<string, string>; } catch { return {}; }
}
