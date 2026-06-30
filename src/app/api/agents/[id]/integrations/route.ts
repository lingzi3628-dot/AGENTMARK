import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setTelegramWebhook, deleteTelegramWebhook, getTelegramBotInfo, deriveWebhookUrl as deriveTelegramWebhookUrl } from "@/lib/telegram";
import { getWhatsAppPhoneNumberInfo, deriveWebhookUrl as deriveWhatsAppWebhookUrl } from "@/lib/whatsapp";
import { testSlackAuth } from "@/lib/slack";
import { EmailClient } from "@/lib/email";
import { VoiceClient } from "@/lib/voice";
import { getPlan } from "@/lib/plans";

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

  // === RATE LIMIT: check integration count against the user's plan ===
  // Look up the agent + its owner to determine the plan limit
  const agent = await db.agent.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (agent?.userId) {
    const user = await db.user.findUnique({
      where: { id: agent.userId },
      select: { plan: true },
    });
    const plan = getPlan(user?.plan || "free");
    const existingCount = await db.integration.count({ where: { agentId: id } });
    if (existingCount >= plan.maxIntegrationsPerAgent) {
      return NextResponse.json(
        {
          error: `Integration limit reached (${plan.maxIntegrationsPerAgent} per agent on the ${plan.name} plan).`,
          limit: plan.maxIntegrationsPerAgent,
          current: existingCount,
          plan: plan.id,
          upgradeUrl: "/billing",
        },
        { status: 429 },
      );
    }
  }

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
  } else if (platform === "email" && config.emailAddress && config.imapHost && config.smtpHost && config.password) {
    try {
      // Validate IMAP + SMTP credentials by opening a test connection.
      // We do NOT poll messages here — just verify we can connect + open INBOX.
      const imapPort = config.imapPort ? Number(config.imapPort) : undefined;
      const smtpPort = config.smtpPort ? Number(config.smtpPort) : undefined;
      const emailClient = new EmailClient({
        imapHost: config.imapHost,
        smtpHost: config.smtpHost,
        imapPort,
        smtpPort,
        user: config.emailAddress,
        pass: config.password,
        tls: true,
      });
      const testResult = await emailClient.testConnection();
      if (!testResult.ok) {
        // Roll back the integration row we just created — invalid creds.
        await db.integration.delete({ where: { id: created.id } }).catch(() => undefined);
        return NextResponse.json(
          { error: `Email credentials invalid: ${testResult.error || "unknown error"}` },
          { status: 400 },
        );
      }
      setupStatus = {
        ok: true,
        message: `Email connected! Polling ${config.emailAddress} every 5 minutes. Use the "Test poll" button on the integration card to fetch + reply immediately.`,
      };
    } catch (e) {
      await db.integration.delete({ where: { id: created.id } }).catch(() => undefined);
      return NextResponse.json(
        { error: `Email validation failed: ${e instanceof Error ? e.message : "unknown error"}` },
        { status: 400 },
      );
    }
  } else if (platform === "voice" && config.accountSid && config.authToken && config.fromNumber) {
    try {
      // Validate Twilio credentials by fetching the Account resource.
      const voiceClient = new VoiceClient({
        accountSid: config.accountSid,
        authToken: config.authToken,
        fromNumber: config.fromNumber,
      });
      const testResult = await voiceClient.testAuth();
      if (!testResult.ok) {
        await db.integration.delete({ where: { id: created.id } }).catch(() => undefined);
        return NextResponse.json(
          { error: `Twilio credentials invalid: ${testResult.error || "unknown error"}` },
          { status: 400 },
        );
      }
      // Surface the inbound webhook URL so the user knows what to paste into the
      // Twilio console (Phone Numbers → Voice & Fax → "A Call Comes In").
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
      const incomingUrl = `${proto}://${host}/api/voice/incoming?i=${created.id}`;
      setupStatus = {
        ok: true,
        message: `Voice connected! Twilio account: ${testResult.friendlyName || config.accountSid}. Set the inbound webhook URL in your Twilio number's Voice settings to: ${incomingUrl}`,
      };
    } catch (e) {
      await db.integration.delete({ where: { id: created.id } }).catch(() => undefined);
      return NextResponse.json(
        { error: `Twilio validation failed: ${e instanceof Error ? e.message : "unknown error"}` },
        { status: 400 },
      );
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
