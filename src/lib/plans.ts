// Plan definitions for AGENTMARK billing tiers.
// Free is the default; Pro and Team are paid upgrades via Paystack Checkout.
// Paystack supports NGN, GHS, ZAR, KES, USD — we price in USD for simplicity.

export interface PlanDef {
  id: "free" | "pro" | "team";
  name: string;
  price: string; // "$0/mo", "$19/mo", "$79/mo"
  priceUsd: number; // 0, 19, 79 — used for Paystack checkout amount
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
    priceUsd: 0,
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
    priceUsd: 19,
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
    priceUsd: 79,
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

// Map plan id → plan definition.
export function getPlan(planId: string): PlanDef {
  return PLANS.find((p) => p.id === planId) || PLANS[0];
}

// Get the configured Paystack plan code for a plan id ("pro" → PAYSTACK_PLAN_PRO env).
// Paystack plans are created in the dashboard and have codes like "PLN_xxxxx".
export function priceIdForPlan(planId: "pro" | "team"): string | null {
  const envVar = planId === "pro" ? "PAYSTACK_PLAN_PRO" : "PAYSTACK_PLAN_TEAM";
  return process.env[envVar] || null;
}

// Whether Paystack billing is enabled (server-side env check).
export function billingEnabled(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}
