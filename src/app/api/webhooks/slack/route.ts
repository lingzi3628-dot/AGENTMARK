import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import {
  sendSlackMessage,
  verifySlackSignature,
  type SlackEventPayload,
} from "@/lib/slack";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Slack Events API webhook receiver.
 *
 * Slack POSTs events to this endpoint. We:
 *  - Verify the request signature using SLACK_SIGNING_SECRET (or the
 *    integration's stored signing secret as a fallback).
 *  - Respond to `url_verification` challenges immediately.
 *  - For `message`/`app_mention` events from humans (bot_id falsy), look up
 *    the integration by the `?i={integrationId}` query param, run the agent,
 *    and post the reply back to event.channel.
 *
 * IMPORTANT: Slack requires a 200 response within 3 seconds or it retries
 * (and marks the app as failing). We fire-and-forget the agent run via
 * `Promise.resolve().then(...)` and return 200 immediately.
 */

export async function POST(req: NextRequest) {
  // Slack signs the RAW request body, so we must read it as text (not .json()).
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";
  const signature = req.headers.get("x-slack-signature") || "";

  // Try to parse the payload first — we may need the integration's stored
  // signing secret as a fallback if the global env var isn't set.
  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // For url_verification Slack still signs the request — but we don't yet know
  // which integration it's for. Use the global signing secret.
  const integrationId = req.nextUrl.searchParams.get("i");

  // Resolve signing secret: prefer the integration's stored secret, fall back
  // to the global env var.
  let signingSecret = process.env.SLACK_SIGNING_SECRET || "";
  if (integrationId && !signingSecret) {
    const integ = await db.integration
      .findUnique({ where: { id: integrationId } })
      .catch(() => null);
    if (integ?.platform === "slack") {
      try {
        const cfg = JSON.parse(integ.config) as Record<string, string>;
        if (cfg.signingSecret) signingSecret = cfg.signingSecret;
      } catch {
        // ignore
      }
    }
  }

  if (!signingSecret) {
    console.error(
      "[slack webhook] No signing secret available. Set SLACK_SIGNING_SECRET env var or store it in the integration config.",
    );
    return NextResponse.json({ error: "no signing secret" }, { status: 500 });
  }

  // Verify the request signature
  const valid = verifySlackSignature(signingSecret, timestamp, rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 1) URL verification handshake (Slack calls this once when you configure the Request URL).
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge || "" });
  }

  // 2) Event callbacks
  if (payload.type !== "event_callback" || !payload.event) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const evt = payload.event;
  // Only handle text messages / mentions. Skip anything from bots (else we loop).
  if (evt.bot_id || evt.subtype) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (evt.type !== "message" && evt.type !== "app_mention") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!evt.text || !evt.channel) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!integrationId) {
    return NextResponse.json({ error: "missing integration id" }, { status: 400 });
  }

  // Strip the bot mention prefix: "<@U12345> hello" → "hello"
  const userText = evt.text.replace(/<@[^>]+>\s*/g, "").trim();
  if (!userText) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const channel = evt.channel;
  const senderName = evt.user || "unknown";

  // CRITICAL: respond within 3 seconds. Fire-and-forget the agent run.
  // Next.js Route Handlers expose `waitUntil` via the runtime context, but
  // a simple detached promise works too as long as the process stays up.
  // We use Promise.resolve().then(...) to start the async work without awaiting.
  Promise.resolve()
    .then(() => runSlackAgent(integrationId, userText, senderName, channel))
    .catch((err) =>
      console.error("[slack webhook] fire-and-forget agent run failed:", err),
    );

  return NextResponse.json({ ok: true });
}

/** Runs the agent and posts the reply to Slack. Detached from the request lifecycle. */
async function runSlackAgent(
  integrationId: string,
  userText: string,
  senderName: string,
  channel: string,
): Promise<void> {
  const targetIntegration = await db.integration
    .findUnique({
      where: { id: integrationId },
      include: { agent: true },
    })
    .catch(() => null);

  if (!targetIntegration || !targetIntegration.agent) {
    console.warn("[slack webhook] no matching integration for id:", integrationId);
    return;
  }
  if (!targetIntegration.enabled) return;

  let cfg: Record<string, string> = {};
  try {
    cfg = JSON.parse(targetIntegration.config) as Record<string, string>;
  } catch {
    cfg = {};
  }
  const botToken = cfg.botToken;
  if (!botToken) {
    console.warn("[slack webhook] integration missing botToken");
    return;
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
        platform: "slack",
        senderName,
        senderId: channel,
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
    console.error("[slack webhook] agent execution error:", err);
  }

  if (!output) {
    output = "I didn't produce a response. Please try rephrasing your message.";
  }

  // Post the reply to Slack
  const sendResult = await sendSlackMessage(botToken, channel, output);

  const durationMs = Date.now() - startedAt;

  // Log the outgoing reply
  await db.messageLog
    .create({
      data: {
        integrationId: targetIntegration.id,
        direction: "outgoing",
        platform: "slack",
        senderName: agent.name,
        senderId: channel,
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
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
