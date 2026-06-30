import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import {
  sendWhatsAppMessage,
  verifyWhatsAppWebhook,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhook receiver.
 *
 * - GET  → Meta calls this once during webhook setup to verify ownership.
 *          We echo back the `hub.challenge` if the verify token matches.
 * - POST → Meta calls this whenever someone messages the connected WhatsApp number.
 *          We run the agent and reply via sendWhatsAppMessage.
 *
 * The integration ID is passed via the `?i={integrationId}` query param so
 * we know which agent to route the message to. The webhook URL we tell Meta
 * to use already includes this param.
 */

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
  if (!verifyToken) {
    console.error(
      "[whatsapp webhook] WHATSAPP_VERIFY_TOKEN env var is not set — cannot verify webhook.",
    );
    return NextResponse.json(
      { error: "verify token not configured" },
      { status: 500 },
    );
  }

  if (verifyWhatsAppWebhook(mode, token, verifyToken)) {
    // Meta expects the raw challenge as the response body (200 status).
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "invalid verify token" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  // Parse the incoming WhatsApp webhook payload
  let payload: WhatsAppWebhookPayload;
  try {
    payload = (await req.json()) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Status updates (delivered/read) come through with `statuses` — acknowledge silently.
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!value || !message) {
    // Not a message event (status update, etc.) — acknowledge silently.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Only handle text messages for now (buttons/interactive/list etc. fall through silently)
  if (message.type !== "text" || !message.text?.body) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const fromPhone = message.from || "";
  const userText = message.text.body;
  const senderName = value.contacts?.[0]?.profile?.name || fromPhone;

  // Find which integration this is for. We embed the integration ID in the webhook URL.
  const integrationId = req.nextUrl.searchParams.get("i");
  if (!integrationId) {
    return NextResponse.json({ error: "missing integration id" }, { status: 400 });
  }

  const targetIntegration = await db.integration
    .findUnique({
      where: { id: integrationId },
      include: { agent: true },
    })
    .catch(() => null);

  if (!targetIntegration || !targetIntegration.agent) {
    return NextResponse.json({ error: "no matching agent" }, { status: 404 });
  }

  if (!targetIntegration.enabled) {
    return NextResponse.json({ ok: true, ignored: true, reason: "disabled" });
  }

  let cfg: Record<string, string> = {};
  try {
    cfg = JSON.parse(targetIntegration.config) as Record<string, string>;
  } catch {
    cfg = {};
  }
  const phoneNumberId = cfg.phoneNumberId;
  const accessToken = cfg.accessToken;
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ error: "missing credentials" }, { status: 400 });
  }

  const agent = targetIntegration.agent;
  const nodes: WorkflowNode[] = safeJsonParse(agent.nodes, []);
  const edges: WorkflowEdge[] = safeJsonParse(agent.edges, []);

  // Log the incoming message
  await db.messageLog
    .create({
      data: {
        integrationId: targetIntegration.id,
        direction: "incoming",
        platform: "whatsapp",
        senderName,
        senderId: fromPhone,
        content: userText.slice(0, 4000),
        status: "delivered",
      },
    })
    .catch(() => undefined);

  const startedAt = Date.now();

  // Run the agent (non-streaming — collect the full output)
  let output = "";
  try {
    for await (const ev of executeAgent(nodes, edges, {
      input: userText,
      history: [],
    })) {
      if (ev.type === "done" && ev.output) {
        output = ev.output;
      }
    }
  } catch (err) {
    output = "Sorry, I encountered an error processing your request.";
    console.error("[whatsapp webhook] agent execution error:", err);
  }

  if (!output) {
    output = "I didn't produce a response. Please try rephrasing your message.";
  }

  // Send the reply via WhatsApp Cloud API
  const sendResult = await sendWhatsAppMessage(
    phoneNumberId,
    accessToken,
    fromPhone,
    output,
  );

  const durationMs = Date.now() - startedAt;

  // Log the outgoing reply
  await db.messageLog
    .create({
      data: {
        integrationId: targetIntegration.id,
        direction: "outgoing",
        platform: "whatsapp",
        senderName: agent.name,
        senderId: fromPhone,
        content: output.slice(0, 4000),
        status: sendResult.ok ? "delivered" : "failed",
        tokens: Math.ceil(output.length / 4),
        durationMs,
      },
    })
    .catch(() => undefined);

  // Record the run in history
  await db.runHistory
    .create({
      data: {
        agentId: agent.id,
        input: userText.slice(0, 8000),
        output: output.slice(0, 16000),
        status: "completed",
        tokens: Math.ceil(output.length / 4),
        duration: durationMs,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
