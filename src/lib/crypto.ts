// AES-256-GCM encryption for user-supplied secrets (API keys, Supabase keys, etc.)
// Keys are encrypted at rest in the database. The encryption key is read from
// APP_ENCRYPTION_KEY env var (32-byte hex or base64 string). If unset, falls back
// to a derived dev key (NOT for production use — startup logs a warning).

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV is recommended for GCM

function getKey(): Buffer {
  const env = process.env.APP_ENCRYPTION_KEY;
  if (env) {
    // Accept either a 64-char hex string or a 32+ char passphrase (hashed).
    if (/^[0-9a-fA-F]{64}$/.test(env)) return Buffer.from(env, "hex");
    return createHash("sha256").update(env).digest();
  }
  // Dev fallback — deterministic but never used in production.
  // Logged once on first call so deployers see the warning.
  if (!process.env.APP_ENCRYPTION_KEY_WARNED) {
    console.warn(
      "[crypto] APP_ENCRYPTION_KEY is not set — using insecure dev fallback. " +
        "Set APP_ENCRYPTION_KEY to a 64-char hex string in production.",
    );
    process.env.APP_ENCRYPTION_KEY_WARNED = "1";
  }
  return createHash("sha256").update("agentmark-dev-fallback-key-do-not-use-in-prod").digest();
}

export interface EncryptedPayload {
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

/**
 * Encrypt a plaintext string. Returns a single base64 string of format:
 *   iv(12) || authTag(16) || ciphertext
 * Compact form — suitable for storage in a single DB column.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ct]).toString("base64");
}

/** Decrypt a payload produced by encrypt(). Returns empty string on failure. */
export function decrypt(payload: string): string {
  if (!payload) return "";
  try {
    const buf = Buffer.from(payload, "base64");
    if (buf.length < IV_LEN + 16) return "";
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + 16);
    const ct = buf.subarray(IV_LEN + 16);
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
}

/** Mask a key for display: first 4 + last 4 chars, or "••••" if too short. */
export function maskKey(plainOrMasked: string): string {
  if (!plainOrMasked) return "";
  // If already masked (contains ••••), return as-is.
  if (plainOrMasked.includes("••••")) return plainOrMasked;
  if (plainOrMasked.length < 8) return "••••";
  return plainOrMasked.slice(0, 4) + "••••" + plainOrMasked.slice(-4);
}
