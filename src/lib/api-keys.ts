// Server-side helpers for resolving decrypted API keys for a user.
// Used by the AI execution engine to route model calls through the user's
// own provider quota (BYOK) when available.

import { db } from "./db";
import { decrypt } from "./crypto";

export interface ResolvedApiKey {
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  source: "builtin" | "custom";
  customApiId?: string;
}

/**
 * Resolve the best available API key for a given provider.
 * Priority: custom APIs (most recent active) > built-in BYOK fields on the User.
 * Returns null if the user has no key for that provider.
 */
export async function resolveApiKey(
  userId: string | undefined | null,
  provider: string,
): Promise<ResolvedApiKey | null> {
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (!user) return null;

  // 1. Custom APIs first — user explicitly added these
  const custom = await db.customApi.findFirst({
    where: { userId: user.id, provider, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (custom) {
    const plain = decrypt(custom.encryptedKey);
    if (plain) {
      // Update lastUsedAt asynchronously (non-blocking)
      db.customApi.update({
        where: { id: custom.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => undefined);
      return {
        provider: custom.provider,
        apiKey: plain,
        baseUrl: custom.baseUrl,
        modelName: custom.modelName,
        source: "custom",
        customApiId: custom.id,
      };
    }
  }

  // 2. Built-in BYOK fields
  const builtinMap: Record<string, { field: string; baseUrl: string; modelName: string }> = {
    glm: { field: "glmApiKey", baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelName: "glm-4.6" },
    openai: { field: "openaiApiKey", baseUrl: "https://api.openai.com/v1", modelName: "gpt-4o-mini" },
    anthropic: { field: "anthropicApiKey", baseUrl: "https://api.anthropic.com/v1", modelName: "claude-3-5-sonnet-20241022" },
  };
  const cfg = builtinMap[provider.toLowerCase()];
  if (cfg) {
    const encrypted = (user as unknown as Record<string, string>)[cfg.field];
    if (encrypted) {
      const plain = decrypt(encrypted);
      if (plain) {
        return {
          provider,
          apiKey: plain,
          baseUrl: cfg.baseUrl,
          modelName: cfg.modelName,
          source: "builtin",
        };
      }
    }
  }

  return null;
}

/** Return all of a user's custom APIs (decrypted) — for the execution engine. */
export async function listUserApis(userId: string | undefined | null): Promise<ResolvedApiKey[]> {
  if (!userId) return [];
  const rows = await db.customApi.findMany({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  }).catch(() => []);
  return rows
    .map((r) => {
      const plain = decrypt(r.encryptedKey);
      if (!plain) return null;
      return {
        provider: r.provider,
        apiKey: plain,
        baseUrl: r.baseUrl,
        modelName: r.modelName,
        source: "custom" as const,
        customApiId: r.id,
      };
    })
    .filter(Boolean) as ResolvedApiKey[];
}
