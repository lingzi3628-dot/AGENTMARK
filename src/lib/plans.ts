// Plan definitions for AGENTMARK billing tiers.
// Free is the default; Pro and Team are paid upgrades via Stripe Checkout.

export interface PlanDef {
  id: "free" | "pro" | "team";
  name: string;
  price: string; // "$0/mo", "$19/mo", "$79/mo"
  maxAgents: number; // 2, 25, 100
  dailyTokenLimit: number; // 100000, 500000, 2000000
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "$0/mo",
    maxAgents: 2,
    dailyTokenLimit: 100000,
    features: [
      "2 agents",
      "100K tokens/day",
      "All node types",
      "1 integration platform",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    maxAgents: 25,
    dailyTokenLimit: 500000,
    features: [
      "25 agents",
      "500K tokens/day",
      "All node types",
      "All 9 integrations",
      "Priority support",
      "Custom API keys",
    ],
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$79/mo",
    maxAgents: 100,
    dailyTokenLimit: 2000000,
    features: [
      "100 agents",
      "2M tokens/day",
      "All features",
      "All integrations",
      "SSO + audit log",
      "Dedicated support",
    ],
  },
];

// Map Stripe price IDs (env) → plan definition. Built once at module load.
export function getPlan(planId: string): PlanDef {
  return PLANS.find((p) => p.id === planId) || PLANS[0];
}

// Resolve a Stripe price ID → plan id by matching against env vars.
export function resolvePlanFromPriceId(priceId: string): PlanDef | null {
  if (!priceId) return null;
  if (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO) {
    return getPlan("pro");
  }
  if (process.env.STRIPE_PRICE_TEAM && priceId === process.env.STRIPE_PRICE_TEAM) {
    return getPlan("team");
  }
  return null;
}

// Get the configured Stripe price ID for a plan id ("pro" → STRIPE_PRICE_PRO).
export function priceIdForPlan(planId: "pro" | "team"): string | null {
  const envVar = planId === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_TEAM";
  return process.env[envVar] || null;
}

// Whether Stripe billing is enabled (server-side env check).
export function billingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
