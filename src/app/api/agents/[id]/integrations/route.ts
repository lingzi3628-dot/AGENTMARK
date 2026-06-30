import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setTelegramWebhook, deleteTelegramWebhook, getTelegramBotInfo, deriveWebhookUrl as deriveTelegramWebhookUrl } from "@/lib/telegram";
import { getWhatsAppPhoneNumberInfo, deriveWebhookUrl as deriveWhatsAppWebhookUrl } from "@/lib/whatsapp";
import { testSlackAuth } from "@/lib/slack";

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
        const webhookUrl = `${deriveTelegramWebhookUrl(req)}?i=${created.id}`;
        const registered = await setTelegramWebhook(config.botToken, webhookUrl);
        setupStatus = registered
          ? { ok: true, message: `Bot @${info.username} connected! Send it a message on Telegram to test.` }
          : { ok: false, message: "Token valid but webhook registration failed. Your server URL must be publicly accessible." };
      }
    } catch (e) {
      setupStatus = { ok: false, message: e instanceof Error ? e.message : "setup failed" };
    }
  } else if (platform === "whatsapp" && config.phoneNumberId && config.accessToken) {
    try {
      // Validate the access token + phone number ID by calling the WhatsApp Cloud API.
      const info = await getWhatsAppPhoneNumberInfo(config.phoneNumberId, config.accessToken);
      if (!info.ok) {
        setupStatus = { ok: false, message: `WhatsApp credentials invalid: ${info.error}` };
      } else {
        // Meta auto-registers the webhook when the user verifies it via the GET endpoint.
        // We surface the webhook URL so the user knows what to paste into the Meta dashboard.
        const webhookUrl = `${deriveWhatsAppWebhookUrl(req)}?i=${created.id}`;
        setupStatus = {
          ok: true,
          message: `WhatsApp connected! Send a message to your number to test. Webhook URL: ${webhookUrl}`,
        };
      }
    } catch (e) {
      setupStatus = { ok: false, message: e instanceof Error ? e.message : "setup failed" };
    }
  } else if (platform === "slack" && config.botToken) {
    try {
      // Validate the bot token by calling auth.test
      const info = await testSlackAuth(config.botToken);
      if (!info.ok) {
        setupStatus = { ok: false, message: `Slack bot token invalid: ${info.error}` };
      } else {
        // Slack doesn't require us to register the webhook server-side — the user
        // configures the Request URL in the Slack dashboard. We surface the URL
        // (with the integration id) so they know what to paste in.
        const proto = req.headers.get("x-forwarded-proto") || "https";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
        const webhookUrl = `${proto}://${host}/api/webhooks/slack?i=${created.id}`;
        setupStatus = {
          ok: true,
          message: `Slack connected! Mention your bot (${info.botName || "bot"}) in a channel to test. Webhook URL: ${webhookUrl}`,
        };
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
  // Find integrations and clean up platform-side webhooks before deleting.
  // Only Telegram needs server-side cleanup (we registered the webhook ourselves).
  // WhatsApp + Slack webhooks are configured in their respective dashboards and
  // auto-expire when the app is uninstalled or the credentials are revoked —
  // no server-side cleanup needed.
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
