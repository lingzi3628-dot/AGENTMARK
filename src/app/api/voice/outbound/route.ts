import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { VoiceClient } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Trigger an outbound call from a connected voice integration.
 *
 * Body: { integrationId: string, to: string, message: string }
 *
 * We initiate a call via the Twilio SDK, pointing at /api/voice/outbound-handler
 * for the TwiML. Twilio fetches that URL when the call connects, and the handler
 * responds with <Say> of the message.
 *
 * Returns: { ok: boolean, callSid?: string, error?: string }
 */
export async function POST(req: NextRequest) {
  let body: { integrationId?: string; to?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const integrationId = body.integrationId;
  const to = (body.to || "").trim();
  const message = (body.message || "").trim();

  if (!integrationId || !to || !message) {
    return NextResponse.json(
      { error: "integrationId, to, and message are required" },
      { status: 400 },
    );
  }

  // Basic E.164 sanity check — Twilio requires leading "+".
  if (!to.startsWith("+")) {
    return NextResponse.json(
      { error: "`to` must be in E.164 format (e.g. +14155551234)" },
      { status: 400 },
    );
  }

  const integration = await db.integration
    .findUnique({
      where: { id: integrationId },
      include: { agent: true },
    })
    .catch(() => null);

  if (!integration || integration.platform !== "voice") {
    return NextResponse.json({ error: "integration not found or not voice" }, { status: 404 });
  }

  if (!integration.enabled) {
    return NextResponse.json({ error: "integration is disabled" }, { status: 400 });
  }

  let cfg: Record<string, string> = {};
  try {
    cfg = JSON.parse(integration.config) as Record<string, string>;
  } catch {
    cfg = {};
  }

  const accountSid = cfg.accountSid || "";
  const authToken = cfg.authToken || "";
  const fromNumber = cfg.fromNumber || "";
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: "missing Twilio credentials" }, { status: 400 });
  }

  const client = new VoiceClient({ accountSid, authToken, fromNumber });

  // Build the handler URL — Twilio will fetch this when the call connects.
  // We pass the message via query string (URL-encoded) — Twilio forwards it back.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const encodedMsg = encodeURIComponent(message);
  const handlerUrl = `${proto}://${host}/api/voice/outbound-handler?i=${integration.id}&msg=${encodedMsg}`;

  const callSid = await client.makeCall(to, handlerUrl);
  if (!callSid) {
    return NextResponse.json(
      { ok: false, error: "Twilio call creation failed — check credentials and verify the `to` number is callable from your account (trial accounts can only call verified numbers)." },
      { status: 502 },
    );
  }

  // Log the outbound call
  await db.messageLog
    .create({
      data: {
        integrationId: integration.id,
        direction: "outgoing",
        platform: "voice",
        senderName: integration.agent?.name || "Voice Agent",
        senderId: to,
        content: `[Outbound call to ${to}] ${message.slice(0, 1000)}`,
        status: "delivered",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true, callSid });
}
