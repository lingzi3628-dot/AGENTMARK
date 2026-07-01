// AGENTMARK is free and open source — no paid plans.
// This file is kept for backwards compatibility with code that references PLANS.

export interface PlanDef {
  id: "free";
  name: string;
  price: string;
  priceUsd: number;
  maxAgents: number;
  maxIntegrationsPerAgent: number;
  maxWebhookTriggersPerAgent: number;
  maxSchedulesPerAgent: number;
  dailyTokenLimit: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "$0/forever",
    priceUsd: 0,
    maxAgents: 2,
    maxIntegrationsPerAgent: 2,
    maxWebhookTriggersPerAgent: 2,
    maxSchedulesPerAgent: 2,
    dailyTokenLimit: 100000,
    features: [
      "2 agents",
      "100K tokens/day",
      "All node types",
      "All integrations",
      "Local model support",
      "Open source (MIT)",
    ],
  },
];

export function getPlan(_planId: string): PlanDef {
  return PLANS[0]; // always free
}

export function priceIdForPlan(_planId: string): string | null {
  return null; // no paid plans
}

export function billingEnabled(): boolean {
  return false; // always free
}

export function spendLimitForPlan(_planId: string): number {
  return 100; // $1.00 daily spend limit (in cents) — for cost tracking display
}
