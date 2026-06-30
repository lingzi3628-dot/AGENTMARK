"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Check,
  Crown,
  Loader2,
  Sparkles,
  ExternalLink,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { PLANS, getPlan, type PlanDef } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PlanRank = "free" | "pro" | "team";

const PLAN_RANK: Record<PlanRank, number> = { free: 0, pro: 1, team: 2 };

function currentRank(planId: string): number {
  return PLAN_RANK[(planId as PlanRank) || "free"] ?? 0;
}

export function BillingView() {
  const { user, setUser } = useAuth();
  const [billingEnabled, setBillingEnabled] = useState<boolean | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  // Fetch billing-enabled status once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/status");
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { enabled: boolean };
          setBillingEnabled(data.enabled);
        } else {
          setBillingEnabled(false);
        }
      } catch {
        setBillingEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/me?uid=${user.firebaseUid}`);
      if (res.ok) {
        const updated = await res.json();
        setUser({ ...user, ...updated });
      }
    } catch {
      // non-fatal — webhook will eventually catch up
    }
  }, [user, setUser]);

  // If the user lands here from a Stripe success redirect, poll once for
  // the webhook to have updated their plan.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      toast.success("Payment received — syncing your plan…");
      const interval = window.setInterval(() => {
        void refreshUser();
      }, 2000);
      const stop = window.setTimeout(() => window.clearInterval(interval), 20000);
      return () => {
        window.clearInterval(interval);
        window.clearTimeout(stop);
      };
    }
    return undefined;
  }, [refreshUser]);

  if (!user) return null;

  const userPlan = getPlan(user.plan);
  const userRank = currentRank(user.plan);

  async function handleCheckout(plan: PlanDef) {
    if (!user) return;
    if (!billingEnabled) {
      toast.info("Billing is coming soon — we'll let you know when payments launch.");
      return;
    }
    // The client sends the plan id ("pro" / "team") as the priceId; the
    // server resolves it to the actual STRIPE_PRICE_* env var. This keeps
    // the Stripe price IDs (server-side secrets) off the client.
    setBusyPlan(plan.id);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user!.firebaseUid,
          priceId: plan.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: string }).error;
        if (err === "billing_disabled") {
          toast.info("Billing is coming soon.");
          return;
        }
        if (err === "unknown_price") {
          toast.error(
            `Plan price not configured. Add STRIPE_PRICE_${plan.id.toUpperCase()} env var.`,
          );
          return;
        }
        throw new Error(err || "checkout_failed");
      }
      const url = (data as { url?: string }).url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("no_url");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setBusyPlan(null);
    }
  }

  async function handlePortal() {
    if (!user) return;
    if (!billingEnabled) {
      toast.info("Billing is coming soon.");
      return;
    }
    if (!user.stripeCustomerId) {
      toast.info("You don't have an active subscription to manage yet.");
      return;
    }
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user!.firebaseUid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: string }).error;
        if (err === "no_customer") {
          toast.info("You don't have an active subscription to manage yet.");
          return;
        }
        throw new Error(err || "portal_failed");
      }
      const url = (data as { url?: string }).url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("no_url");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open customer portal");
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Crown className="h-5 w-5 text-primary" />
              Plans & Billing
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade for more agents, higher token limits, and priority support.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "w-fit gap-1.5 px-3 py-1",
              user.plan === "free"
                ? "bg-muted text-muted-foreground"
                : "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            <Crown className="h-3.5 w-3.5" />
            Current: {userPlan.name}
          </Badge>
        </div>

        {/* Disabled-state banner */}
        {billingEnabled === false && (
          <Card className="border-dashed border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Billing is coming soon
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Paid upgrades aren&apos;t live yet — set the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">STRIPE_SECRET_KEY</code>{" "}
                  env var to enable checkout. The Free tier is fully available.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === user.plan;
            const isUpgrade = PLAN_RANK[plan.id] > userRank;
            const isDowngrade = PLAN_RANK[plan.id] < userRank;
            const busy = busyPlan === plan.id;
            const disabled = billingEnabled === false || busy || isCurrent || billingEnabled === null;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col p-5 transition-shadow",
                  plan.highlighted
                    ? "border-primary/40 shadow-lg shadow-primary/5"
                    : "border-border",
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 gap-1 bg-primary px-2.5 py-0.5 text-[10px] text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> POPULAR
                  </Badge>
                )}

                <div className="mb-3">
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                  </div>
                </div>

                <Separator className="mb-4" />

                <ul className="mb-5 space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <Badge
                    variant="outline"
                    className="w-full justify-center gap-1.5 border-primary/30 bg-primary/10 py-2 text-primary"
                  >
                    <Check className="h-3.5 w-3.5" /> Current plan
                  </Badge>
                ) : billingEnabled === false ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        disabled
                        variant={plan.highlighted ? "default" : "outline"}
                        className="w-full gap-1.5"
                      >
                        <Lock className="h-4 w-4" /> Coming soon
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Stripe is not configured on this deployment.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    onClick={() => handleCheckout(plan)}
                    disabled={disabled}
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full gap-1.5"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isUpgrade ? (
                      <Crown className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Switch"}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Manage subscription */}
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Manage your subscription</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update payment method, switch plans, or cancel anytime via the Stripe customer portal.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={
                portalBusy ||
                billingEnabled === false ||
                billingEnabled === null ||
                !user.stripeCustomerId
              }
              className="gap-1.5"
            >
              {portalBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Customer Portal
            </Button>
          </div>
        </Card>

        {/* Trust footer */}
        <p className="text-center text-xs text-muted-foreground">
          Payments are securely processed by Stripe. AGENTMARK never sees or stores your card details.
        </p>
      </div>
    </div>
  );
}
