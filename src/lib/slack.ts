// Slack API helpers — post messages, verify request signatures.
// Docs: https://api.slack.com/apis/connections/events-api

import * as crypto from "node:crypto";

const SLACK_API_BASE = "https://slack.com/api";

/** Slack Events API payload shape (subset — we only read what we need). */
export interface SlackEventPayload {
  token?: string;
  challenge?: string;
  type?: "url_verification" | "event_callback";
  event?: {
    type?: string; // "message" | "app_mention" | ...
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    bot_id?: string; // present when the message is from a bot
    subtype?: string;
  };
  team_id?: string;
  api_app_id?: string;
  event_id?: string;
}

/**
 * Post a message to a Slack channel using chat.postMessage.
 * Splits messages longer than 40000 chars (Slack's hard limit per message).
 */
export async function sendSlackMessage(
  botToken: string,
  channel: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!botToken || !channel) {
    return { ok: false, error: "missing botToken or channel" };
  }
  const chunks = splitMessage(text, 39000);
  let lastError: string | undefined;
  for (const chunk of chunks) {
    try {
      const res = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${botToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          channel,
          text: chunk,
          // Don't unfurl links — keeps the reply clean.
          unfurl_links: false,
          unfurl_media: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        lastError = data?.error || `Slack API responded ${res.status}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network error";
    }
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}

/**
 * Verify the Slack request signature using HMAC-SHA256.
 * Slack signs every Events API request with the app's Signing Secret.
 *
 * Format of the `X-Slack-Signature` header: `v0=<hex digest>`.
 * The basestring is: `v0:<timestamp>:<raw body>`.
 */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  if (!signingSecret || !timestamp || !signature) return false;

  // Reject replays older than 5 minutes
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > 300) return false;

  const basestring = `v0:${timestamp}:${body}`;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(basestring).digest("hex");

  // Constant-time compare to avoid timing attacks.
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

/**
 * Validate the Slack bot token by calling auth.test.
 * Returns the bot's user_id and name on success.
 */
export async function testSlackAuth(
  botToken: string,
): Promise<{ ok: boolean; botUserId?: string; botName?: string; error?: string }> {
  if (!botToken) return { ok: false, error: "missing botToken" };
  try {
    const res = await fetch(`${SLACK_API_BASE}/auth.test`, {
      headers: { authorization: `Bearer ${botToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok === true) {
      return {
        ok: true,
        botUserId: data.user_id,
        botName: data.user,
      };
    }
    return { ok: false, error: data?.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Split long messages into chunks that fit Slack's ~40000 char limit. */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.5) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
