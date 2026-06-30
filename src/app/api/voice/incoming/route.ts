import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateTwiMLResponse } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Twilio inbound voice webhook.
 *
 * When someone calls the connected Twilio number, Twilio POSTs to this URL
 * (configured in the Twilio console under Phone Numbers → Voice & Fax).
 * The integration ID is in the `?i={integrationId}` query param.
 *
 * We respond with TwiML containing:
 *   - A greeting <Say> asking the caller to leave a message
 *   - A <Gather input="speech"> that captures the caller's speech and POSTs
 *     the transcript to /api/voice/process?i={integrationId}
 *
 * Twilio handles STT (speech-to-text) and TTS (text-to-speech via Polly).
 */
export async function POST(req: NextRequest) {
  const integrationId = req.nextUrl.searchParams.get("i");
  if (!integrationId) {
    return twimlResponse(generateTwiMLResponse(
      "This phone number is not configured correctly. Please contact the administrator.",
    ));
  }

  const integration = await db.integration
    .findUnique({
      where: { id: integrationId },
      include: { agent: true },
    })
    .catch(() => null);

  if (!integration || !integration.agent || !integration.enabled) {
    return twimlResponse(generateTwiMLResponse(
      "This agent is currently unavailable. Goodbye.",
    ));
  }

  // Build the absolute URL Twilio should POST the speech transcript to.
  // We re-use the inbound host so this works behind the Caddy gateway.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const processUrl = `${proto}://${host}/api/voice/process?i=${integration.id}`;

  const greeting = `Hello! You've reached ${integration.agent.name}. Please leave your message after the tone, and I'll respond.`;

  // Log the incoming call event
  await db.messageLog
    .create({
      data: {
        integrationId: integration.id,
        direction: "incoming",
        platform: "voice",
        senderName: "Inbound caller",
        senderId: req.headers.get("x-forwarded-for") || "unknown",
        content: "[Inbound call started]",
        status: "delivered",
      },
    })
    .catch(() => undefined);

  return twimlResponse(generateTwiMLResponse(greeting, processUrl));
}

function twimlResponse(twiml: string) {
  return new Response(twiml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
