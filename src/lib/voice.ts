// Voice (Twilio) helpers — outbound calls, SMS, and TwiML generators for inbound
// call flows. Uses the official `twilio` SDK. TTS is done via Twilio's built-in
// <Say> verb (Polly voices) and STT via <Gather input="speech"> — no extra API
// integrations needed.
//
// Docs:
//   TwiML:    https://www.twilio.com/docs/voice/twiml
//   <Say>:    https://www.twilio.com/docs/voice/twiml/say
//   <Gather>: https://www.twilio.com/docs/voice/twiml/gather
//   SDK:      https://www.twilio.com/docs/libraries/node

import Twilio from "twilio";

export interface VoiceClientConfig {
  accountSid: string; // starts with "AC..."
  authToken: string;
  /** Twilio phone number in E.164 (e.g. +1234567890). */
  fromNumber: string;
}

/**
 * VoiceClient — thin wrapper around the Twilio SDK. One instance per
 * integration. All methods catch errors and return a structured result —
 * never throw — so webhook handlers stay robust.
 */
export class VoiceClient {
  readonly client: Twilio.Twilio;
  readonly fromNumber: string;
  readonly accountSid: string;

  constructor(config: VoiceClientConfig) {
    // The `twilio` module exports a callable factory function (with a
    // namespace attached). Calling it returns a fully-initialised client.
    this.client = Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    this.accountSid = config.accountSid;
  }

  /**
   * Verify credentials by fetching the Account resource. Returns ok:false +
   * error message on failure.
   */
  async testAuth(): Promise<{ ok: boolean; error?: string; friendlyName?: string }> {
    try {
      const account = await this.client.api.v2010.accounts(this.accountSid).fetch();
      return { ok: true, friendlyName: account.friendlyName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  /**
   * Place an outbound call. `twimlUrl` must be a publicly reachable URL that
   * returns TwiML — Twilio fetches it when the call connects. Returns the
   * call SID on success or null on failure.
   */
  async makeCall(to: string, twimlUrl: string): Promise<string | null> {
    try {
      const call = await this.client.calls.create({
        to,
        from: this.fromNumber,
        url: twimlUrl,
        // 30s ring timeout — Twilio default is 60s which feels long.
        timeout: 30,
      });
      return call.sid ?? null;
    } catch (err) {
      console.error(
        "[voice] makeCall failed:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  /**
   * Send an SMS via the same Twilio number. Used for follow-up messages after
   * a call (e.g. "Here's a summary of what we discussed..."). Returns the
   * message SID or null.
   */
  async sendSms(to: string, body: string): Promise<string | null> {
    try {
      const msg = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body: body.slice(0, 1600), // Twilio SMS limit is 1600 chars
      });
      return msg.sid ?? null;
    } catch (err) {
      console.error(
        "[voice] sendSms failed:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }
}

// ------------------- TwiML generators -------------------
// We build TwiML as a string (rather than using the twilio.twiml.VoiceResponse
// class) so the response can be served directly with the right Content-Type
// and we have full control over the output. XML-escaping is mandatory —
// unescaped user content would break the TwiML parser.

/**
 * Generate a TwiML response that:
 *   1. Says `text` to the caller (TTS via Polly).
 *   2. Optionally starts a <Gather> for speech input — when the caller
 *      speaks, Twilio POSTs the transcript to `gatherSpeechUrl`.
 */
export function generateTwiMLResponse(
  text: string,
  gatherSpeechUrl?: string,
): string {
  const escaped = xmlEscape(text);
  if (gatherSpeechUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${xmlAttrEscape(gatherSpeechUrl)}" method="POST" speechTimeout="auto" timeout="5">
    <Say voice="Polly.Joanna-Neural">${escaped}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">I didn't catch that. Goodbye.</Say>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escaped}</Say>
</Response>`;
}

/**
 * Generate a TwiML response with a <Gather> that loops back to itself — used
 * for multi-turn inbound calls where the caller can speak, hear a reply, and
 * speak again until they say "goodbye" or hang up.
 */
export function generateConversationTwiML(
  replyText: string,
  gatherUrl: string,
  goodbyePhrases: string[] = ["goodbye", "bye", "good bye", "that's all", "stop"],
): string {
  const escaped = xmlEscape(replyText);
  // Append a hint that the caller can say goodbye to end the call.
  const withHint = `${escaped}\n\nSay "goodbye" to end this call, or ask your next question.`;
  const hint = xmlEscape(withHint);
  const goodbye = goodbyePhrases.map((p) => xmlEscape(p)).join(",");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${xmlAttrEscape(gatherUrl)}" method="POST" speechTimeout="auto" timeout="8" hints="${goodbye}">
    <Say voice="Polly.Joanna-Neural">${hint}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Goodbye!</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate a simple TwiML <Say> response with no gather — terminal reply.
 */
export function generateSayTwiML(text: string, withHangup = false): string {
  const escaped = xmlEscape(text);
  const hangup = withHangup ? "\n  <Hangup/>" : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural">${escaped}</Say>${hangup}
</Response>`;
}

/**
 * Generate TwiML with <Connect><Stream> for bidirectional real-time audio
 * streaming (advanced — used for live audio piping through a custom WebSocket).
 * Currently unused but exported for future use.
 */
export function generateVoiceConnectTwiml(streamUrl: string): string {
  const escaped = xmlAttrEscape(streamUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escaped}"/>
  </Connect>
</Response>`;
}

// ------------------- utilities -------------------

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Attribute values use the same escaping as element text in TwiML. */
function xmlAttrEscape(s: string): string {
  return xmlEscape(s);
}

/** Detect "goodbye" / "end the call" intent from the caller's transcribed speech. */
export function isGoodbyeIntent(speech: string): boolean {
  const text = (speech || "").toLowerCase().trim();
  if (!text) return false;
  const phrases = ["goodbye", "bye", "good bye", "that's all", "stop", "hang up", "end call", "end the call"];
  return phrases.some((p) => text === p || text.includes(p));
}
