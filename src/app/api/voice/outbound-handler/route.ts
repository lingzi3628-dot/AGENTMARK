import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateSayTwiML } from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Twilio webhook for outbound calls.
 *
 * When /api/voice/outbound triggers a call via the Twilio SDK, it points the
 * call's `url` at this handler. Twilio fetches it when the callee picks up,
 * and we respond with TwiML: <Say> of the message, then <Hangup>.
 *
 * Query params:
 *   - i={integrationId}  — for logging / context
 *   - msg={urlencoded}   — the message to speak
 */
export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const integrationId = sp.get("i") || "";
  const rawMsg = sp.get("msg") || "";
  let message = "";
  try {
    message = decodeURIComponent(rawMsg);
  } catch {
    message = rawMsg;
  }

  if (!message) {
    return twimlResponse(generateSayTwiML("Hello, this is an automated message. Goodbye.", true));
  }

  // Best-effort log — if the integration is missing we still speak the message.
  if (integrationId) {
    const integration = await db.integration
      .findUnique({ where: { id: integrationId }, include: { agent: true } })
      .catch(() => null);

    if (integration) {
      let formData: FormData | null = null;
      try {
        formData = await req.formData();
      } catch {
        formData = null;
      }
      const toNumber = formData?.get("To") as string || "";
      const callSid = formData?.get("CallSid") as string || "";

      await db.messageLog
        .create({
          data: {
            integrationId: integration.id,
            direction: "outgoing",
            platform: "voice",
            senderName: integration.agent?.name || "Voice Agent",
            senderId: toNumber || callSid,
            content: message.slice(0, 4000),
            status: "delivered",
          },
        })
        .catch(() => undefined);
    }
  }

  return twimlResponse(generateSayTwiML(message, true));
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
