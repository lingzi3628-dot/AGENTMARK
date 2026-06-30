import * as crypto from "node:crypto";
import jmespath from "jmespath";

// ---------------------------------------------------------------------------
// Token + URL helpers
// ---------------------------------------------------------------------------

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TOKEN_LENGTH = 32;

/** Generate a random 32-char URL-safe token for a webhook trigger. */
export function generateWebhookToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/** Build the absolute webhook URL for a given token, derived from the request. */
export function deriveWebhookUrl(
  headers: Headers,
  token: string,
): string {
  const proto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost";
  return `${proto}://${host}/api/triggers/webhook/${token}`;
}

// ---------------------------------------------------------------------------
// HMAC signature verification (constant-time)
// ---------------------------------------------------------------------------

/**
 * Verify an HMAC-SHA256 signature sent in the `X-Webhook-Signature` header.
 * The signature should be the hex digest of HMAC-SHA256(secret, rawBody).
 * Also accepts a "sha256=<hex>" format (GitHub-style).
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const incoming = signatureHeader.trim().startsWith("sha256=")
    ? signatureHeader.trim().slice("sha256=".length)
    : signatureHeader.trim();

  if (incoming.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// JMESPath filter evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a JMESPath filter expression against the parsed JSON payload.
 * Returns true (fire) if the expression is empty, or if it evaluates to a
 * truthy value. Throws on invalid expressions.
 */
export function evaluateFilter(expr: string, payload: unknown): boolean {
  if (!expr || !expr.trim()) return true;
  try {
    const result = jmespath.search(payload, expr);
    if (result === null || result === undefined) return false;
    if (typeof result === "boolean") return result;
    if (typeof result === "number") return result !== 0;
    if (typeof result === "string") return result.length > 0 && result !== "false";
    if (Array.isArray(result)) return result.length > 0;
    // object → truthy
    return true;
  } catch {
    // Invalid expression → treat as "no match" (safer than firing)
    return false;
  }
}

// ---------------------------------------------------------------------------
// Input template rendering
// ---------------------------------------------------------------------------

/**
 * Apply an input template to the webhook payload.
 *
 * Template syntax:
 *   - `{{payload}}` → the entire payload, JSON-stringified (pretty)
 *   - `{{payload.foo.bar}}` → resolve the dotted path on the payload
 *
 * Unknown paths render as the literal token (so users can see what went wrong).
 * Anything outside `{{ }}` is preserved verbatim.
 *
 * Examples:
 *   "Email from {{payload.from}}: {{payload.subject}}"
 *   "Message: {{payload.message.text}}"
 */
export function renderInputTemplate(template: string, payload: unknown): string {
  if (!template || !template.trim()) {
    // Default: pass the entire payload as JSON
    return safeStringify(payload);
  }

  // Replace every {{...}} token.
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const path = String(expr).trim();
    if (!path.startsWith("payload")) {
      // Only `payload.*` is supported — leave the token alone.
      return `{{${path}}}`;
    }
    if (path === "payload") {
      return safeStringify(payload);
    }
    // Strip the leading "payload." and resolve.
    const subPath = path.replace(/^payload\.?/, "");
    if (!subPath) return safeStringify(payload);
    const value = resolvePath(payload, subPath);
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return safeStringify(value);
  });
}

function resolvePath(obj: unknown, dotted: string): unknown {
  const parts = dotted.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else if (Array.isArray(cur) && /^\d+$/.test(p)) {
      cur = cur[Number(p)];
    } else {
      return undefined;
    }
  }
  return cur;
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
