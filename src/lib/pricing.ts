/**
 * Provider pricing tables (per million tokens, in USD cents).
 *
 * The AGENTMARK Free tier (pollinations.ai / free-*) is $0 — it's covered
 * by the free quota and never billed. GLM models use the Zhipu list prices.
 * OpenAI / Anthropic / Mistral entries are best-effort 2024 catalog prices
 * for users who supply their own keys via the Custom API store.
 *
 * `calculateCost` returns cost in USD cents (integer) — matches the
 * `costCents` columns on RunHistory / CostRecord / UsageRecord / User.
 */

export interface ProviderPricing {
  /** USD cents per 1M input tokens */
  input: number;
  /** USD cents per 1M output tokens */
  output: number;
}

export const PRICING: Record<string, ProviderPricing> = {
  // AGENTMARK Free — $0 (covered by free tier)
  "free-openai": { input: 0, output: 0 },
  "free-mistral": { input: 0, output: 0 },
  "free-llama": { input: 0, output: 0 },
  "free-qwen": { input: 0, output: 0 },

  // GLM (Zhipu) — approximate pricing as of 2024
  "glm-4.6": { input: 500, output: 1500 }, // $5/M in, $15/M out
  "glm-4.5": { input: 500, output: 1500 },
  "glm-4.5-air": { input: 100, output: 100 }, // $1/M
  "glm-4.5v": { input: 500, output: 1500 },

  // OpenAI
  "openai:gpt-4o": { input: 250, output: 1000 },
  "openai:gpt-4o-mini": { input: 15, output: 60 },
  "openai:gpt-4-turbo": { input: 1000, output: 3000 },
  "openai:gpt-3.5-turbo": { input: 50, output: 150 },

  // Anthropic
  "anthropic:claude-3-5-sonnet": { input: 300, output: 1500 },
  "anthropic:claude-3-5-haiku": { input: 80, output: 400 },
  "anthropic:claude-3-opus": { input: 1500, output: 7500 },
  "anthropic:claude-3-haiku": { input: 25, output: 125 },

  // Mistral
  "mistral:large": { input: 200, output: 600 },
  "mistral:small": { input: 20, output: 60 },
  "mistral:8x7b": { input: 70, output: 70 },

  // Cohere
  "cohere:command-r-plus": { input: 250, output: 1000 },
  "cohere:command-r": { input: 15, output: 60 },

  // Together AI / DeepSeek / Groq (OpenAI-compatible providers)
  "together:llama-3-70b": { input: 90, output: 90 },
  "deepseek:deepseek-chat": { input: 14, output: 28 },
  "groq:llama-3-70b": { input: 59, output: 79 },
};

/** Default daily spend limits per plan, in USD cents. */
export const SPEND_LIMIT_CENTS: Record<string, number> = {
  free: 100, // $1.00/day
  pro: 1000, // $10.00/day
  team: 5000, // $50.00/day
};

export function spendLimitForPlan(plan: string): number {
  return SPEND_LIMIT_CENTS[plan] ?? SPEND_LIMIT_CENTS.free;
}

/**
 * Calculate cost in USD cents (integer) for a given provider + token counts.
 *
 * Lookup strategy:
 *   1. Exact provider key (e.g. "openai:gpt-4o-mini").
 *   2. Bare provider prefix (e.g. "openai" from "openai:gpt-4o-mini").
 *   3. Fallback { input: 0, output: 0 } — for free-* models and unknowns.
 */
export function calculateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p =
    PRICING[provider] ??
    PRICING[provider.split(":")[0]] ??
    { input: 0, output: 0 };
  const cents = (p.input * inputTokens + p.output * outputTokens) / 1_000_000;
  return Math.max(0, Math.round(cents));
}

/** Format a cost in cents as a USD string (e.g. 145 → "$1.45"). */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Plan spend limit in USD (float) — used for display. */
export function formatSpendLimit(plan: string): string {
  return formatUsd(spendLimitForPlan(plan));
}
