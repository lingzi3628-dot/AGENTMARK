import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai";
import {
  generateConversationTwiML,
  generateSayTwiML,
  isGoodbyeIntent,
} from "@/lib/voice";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Twilio voice processing callback.
 *
 * After the caller speaks (captured by <Gather> in /api/voice/incoming), Twilio
 * POSTs the transcribed speech to this URL as URL-encoded form data.
 *
 * We:
 *   1. Parse SpeechResult from the form body (Twilio doesn't send JSON!).
 *   2. Look up the integration + agent.
 *   3. Run the agent with the transcribed speech as input.
 *   4. Respond with TwiML:
 *      - If the caller said "goodbye" → <Say> goodbye + <Hangup>.
 *      - Otherwise → <Say> the agent's reply + another <Gather> for the next
 *        turn (loop until the caller hangs up or says goodbye).
 *
 * Note: Twilio also sends Confidence (0-1), From (caller number), CallSid, etc.
 */
export async function POST(req: NextRequest) {
  const integrationId = req.nextUrl.searchParams.get("i");
  if (!integrationId) {
    return twimlResponse(generateSayTwiML(
      "Missing integration ID. Goodbye.",
      true,
    ));
  }

  // Twilio POSTs application/x-www-form-urlencoded — req.formData() parses it.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return twimlResponse(generateSayTwiML(
      "I didn't catch that. Goodbye.",
      true,
    ));
  }

  const speechResult = (form.get("SpeechResult") as string || "").toString().trim();
  const confidence = parseFloat((form.get("Confidence") as string) || "0") || 0;
  const fromNumber = (form.get("From") as string || "").toString();
  const callSid = (form.get("CallSid") as string || "").toString();

  if (!speechResult) {
    // No speech captured (timeout / silence) — end the call gracefully.
    return twimlResponse(generateSayTwiML(
      "I didn't hear anything. Goodbye!",
      true,
    ));
  }

  const integration = await db.integration
    .findUnique({
      where: { id: integrationId },
      include: { agent: true },
    })
    .catch(() => null);

  if (!integration || !integration.agent || !integration.enabled) {
    return twimlResponse(generateSayTwiML(
      "This agent is no longer available. Goodbye.",
      true,
    ));
  }

  // --- Log incoming speech ---
  await db.messageLog
    .create({
      data: {
        integrationId: integration.id,
        direction: "incoming",
        platform: "voice",
        senderName: fromNumber,
        senderId: fromNumber || callSid,
        content: speechResult.slice(0, 4000),
        status: "delivered",
      },
    })
    .catch(() => undefined);

  // --- Check for goodbye intent first (saves an agent run) ---
  if (isGoodbyeIntent(speechResult)) {
    await db.messageLog
      .create({
        data: {
          integrationId: integration.id,
          direction: "outgoing",
          platform: "voice",
          senderName: integration.agent.name,
          senderId: fromNumber,
          content: "Goodbye!",
          status: "delivered",
        },
      })
      .catch(() => undefined);
    return twimlResponse(generateSayTwiML("Goodbye!", true));
  }

  // --- Run the agent ---
  const agent = integration.agent;
  const nodes: WorkflowNode[] = safeJsonParse(agent.nodes, []);
  const edges: WorkflowEdge[] = safeJsonParse(agent.edges, []);

  const startedAt = Date.now();
  let output = "";
  try {
    for await (const ev of executeAgent(nodes, edges, {
      input: speechResult,
      history: [],
    })) {
      if (ev.type === "done" && ev.output) {
        output = ev.output;
      }
    }
  } catch (err) {
    console.error(
      "[voice process] agent execution failed:",
      err instanceof Error ? err.message : String(err),
    );
    output = "I'm sorry, I ran into an issue processing that. Could you repeat yourself?";
  }

  if (!output) {
    output = "I'm not sure how to respond to that. Could you rephrase?";
  }

  // Voice replies should be brief — long monologues make for terrible UX.
  // Cap at ~600 chars (≈ 1 minute of speech at natural pace).
  const spokenReply = output.slice(0, 600);

  const durationMs = Date.now() - startedAt;

  // --- Log outgoing reply ---
  await db.messageLog
    .create({
      data: {
        integrationId: integration.id,
        direction: "outgoing",
        platform: "voice",
        senderName: agent.name,
        senderId: fromNumber,
        content: spokenReply,
        status: "delivered",
        tokens: Math.ceil(spokenReply.length / 4),
        durationMs,
      },
    })
    .catch(() => undefined);

  // --- Record the run ---
  await db.runHistory
    .create({
      data: {
        agentId: agent.id,
        input: speechResult.slice(0, 8000),
        output: spokenReply.slice(0, 16000),
        status: "completed",
        tokens: Math.ceil(spokenReply.length / 4),
        duration: durationMs,
        source: "integration",
      },
    })
    .catch(() => undefined);

  // --- Respond with TwiML: <Say> the reply + another <Gather> for the next turn ---
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const nextGatherUrl = `${proto}://${host}/api/voice/process?i=${integration.id}`;

  // Use the confidence value as a hint — if Twilio was very unsure, prompt to repeat.
  if (confidence > 0 && confidence < 0.4) {
    return twimlResponse(generateConversationTwiML(
      `I'm not sure I caught that, but here's what I think: ${spokenReply}`,
      nextGatherUrl,
    ));
  }

  return twimlResponse(generateConversationTwiML(spokenReply, nextGatherUrl));
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

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
