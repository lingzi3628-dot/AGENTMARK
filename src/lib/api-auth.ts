import { db } from "./db";
import { createHash, randomBytes } from "crypto";

export interface AuthenticatedUser {
  userId: string;
  apiKeyId: string;
  scopes: string[];
}

const KEY_PREFIX = "am_live_";

/**
 * Authenticate an incoming REST API request via a `Bearer am_live_...` token.
 * Returns null if the header is missing, malformed, or the key is unknown/inactive.
 */
export async function authenticateApiRequest(req: Request): Promise<AuthenticatedUser | null> {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(am_live_[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const plaintext = match[1];
  const hashed = hashKey(plaintext);
  const key = await db.apiKey.findUnique({
    where: { hashedKey: hashed },
    include: { user: true },
  });
  if (!key || !key.isActive || !key.user) return null;
  // Update lastUsedAt (non-blocking)
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return {
    userId: key.userId,
    apiKeyId: key.id,
    scopes: key.scopes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** SHA-256 hash of the plaintext key. Stored in the DB; never compared as plaintext. */
export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Strict scope check. A future "admin" scope could be added to bypass checks. */
export function hasScope(user: AuthenticatedUser, scope: string): boolean {
  return user.scopes.includes(scope);
}

/**
 * Generate a new API key. The plaintext is returned to the caller ONCE on
 * creation; we persist only the SHA-256 hash and a display prefix.
 */
export function generateApiKey(): { plaintext: string; hashedKey: string; prefix: string } {
  const random = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  return {
    plaintext,
    hashedKey: hashKey(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}
