// WhatsApp Cloud API helpers — send messages, verify webhook, derive public URL.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

import { NextRequest } from "next/server";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

/** WhatsApp Cloud API webhook entry shape (subset — we only read what we need). */
export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          type?: string; // "text" | "button" | "interactive" | ...
          from?: string;
          text?: { body?: string };
          timestamp?: string;
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          timestamp?: string;
        }>;
      };
      field?: string;
    }>;
  }>;
}

/**
 * Send a text message via WhatsApp Cloud API.
 * Splits messages longer than 4096 chars into multiple sends (WhatsApp hard limit per message).
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "missing phoneNumberId or accessToken" };
  }
  const chunks = splitMessage(text, 4000);
  let lastError: string | undefined;
  for (const chunk of chunks) {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: chunk },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        lastError =
          (data?.error?.message as string | undefined) ||
          `WhatsApp API responded ${res.status}`;
        // Continue trying remaining chunks — partial delivery is better than none.
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network error";
    }
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}

/**
 * Validate a Meta webhook verify token (used for the GET verification step).
 * The mode must be "subscribe" and the token must match the configured verify token.
 */
export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  verifyToken: string,
): boolean {
  if (!verifyToken) return false;
  return mode === "subscribe" && token === verifyToken;
}

/**
 * Validate the WhatsApp credentials by calling GET /v18.0/{phoneNumberId}
 * with the bearer token. Returns the display phone number on success.
 */
export async function getWhatsAppPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ ok: boolean; displayPhone?: string; error?: string }> {
  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "missing phoneNumberId or accessToken" };
  }
  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      return {
        ok: true,
        displayPhone:
          data?.display_phone_number || data?.verified_name || data?.id,
      };
    }
    return {
      ok: false,
      error: data?.error?.message || `HTTP ${res.status}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Derive the public webhook URL from request headers. */
export function deriveWebhookUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost";
  return `${proto}://${host}/api/webhooks/whatsapp`;
}

/** Split long messages into chunks that fit WhatsApp's ~4096 char limit. */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to split at a newline near the limit
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.5) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
