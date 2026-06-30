"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Check,
  Crown,
  Loader2,
  Sparkles,
  Lock,
  ShieldCheck,
  CreditCard,
  Bell,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { PLANS, getPlan, type PlanDef } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notified, setNotified] = useState(false);

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

  // If the user lands here from a Paystack success redirect, poll once for
  // the webhook to have updated their plan.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true" || params.get("billing") === "success") {
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
    if (params.get("error")) {
      const err = params.get("error");
      const messages: Record<string, string> = {
        billing_disabled: "Billing is not configured yet.",
        payment_failed: "Payment failed or was cancelled.",
        missing_reference: "Missing payment reference.",
        no_plan: "Could not determine which plan you purchased.",
        user_not_found: "Could not find your account.",
        verification_failed: "Payment verification failed.",
      };
      toast.error(messages[err] || "Payment error");
    }
    return undefined;
  }, [refreshUser]);

  if (!user) return null;

  const userPlan = getPlan(user.plan);
  const userRank = currentRank(user.plan);
  const isComingSoon = billingEnabled === false;

  async function handleCheckout(plan: PlanDef) {
    if (!user) return;
    if (!billingEnabled) {
      toast.info("Billing is coming soon — we'll let you know when payments launch.");
      return;
    }
    setBusyPlan(plan.id);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user!.firebaseUid,
          planId: plan.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: string }).error;
        if (err === "billing_disabled") {
          toast.info("Billing is coming soon.");
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

  async function handleCancel() {
    if (!user) return;
    if (!confirm("Cancel your subscription? You'll be downgraded to the Free plan at the end of your billing period.")) {
      return;
    }
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user!.firebaseUid }),
      });
      if (!res.ok) throw new Error();
      toast.success("Subscription cancelled — you're now on the Free plan");
      void refreshUser();
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setPortalBusy(false);
    }
  }

  function handleNotifyMe() {
    // In production, this would POST to a /api/billing/notify endpoint.
    // For now, just store in localStorage so the user gets a confirmation.
    if (notifyEmail.trim() && /\S+@\S+\.\S+/.test(notifyEmail)) {
      try {
        const existing = JSON.parse(localStorage.getItem("agentmark.notifyList") || "[]");
        if (!existing.includes(notifyEmail)) {
          existing.push(notifyEmail);
          localStorage.setItem("agentmark.notifyList", JSON.stringify(existing));
        }
      } catch {
        // non-fatal
      }
      setNotified(true);
      toast.success("You're on the list! We'll email you when billing launches.", {
        description: notifyEmail,
      });
    } else {
      toast.error("Please enter a valid email address");
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

        {/* COMING SOON banner — prominent */}
        {isComingSoon && (
          <Card className="relative overflow-hidden border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-card p-5">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/15 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-amber-600 dark:text-amber-400">
                      Billing is Coming Soon
                    </h3>
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] uppercase">
                      In Development
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    We&apos;re integrating{" "}
                    <span className="font-medium text-foreground">Paystack</span>{" "}
                    to bring you secure payments across Africa and beyond.
                    Get notified when billing goes live — sign up below and we&apos;ll email you.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:w-72">
                {notified ? (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> You&apos;re on the list!
                  </div>
                ) : (
                  <>
                    <Input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-9 text-sm"
                    />
                    <Button onClick={handleNotifyMe} size="sm" className="gap-1.5">
                      <Bell className="h-3.5 w-3.5" /> Notify me
                    </Button>
                  </>
                )}
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
            const disabled = isComingSoon || busy || isCurrent || billingEnabled === null;

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
                ) : isComingSoon ? (
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
                      Paystack billing launches soon — sign up above to be notified.
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

        {/* Manage subscription — only shown when billing is enabled and user has a subscription */}
        {!isComingSoon && user.plan !== "free" && (
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Manage your subscription</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Cancel your subscription anytime — you&apos;ll be downgraded to Free at the end of your billing period.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={portalBusy}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                {portalBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Cancel Subscription
              </Button>
            </div>
          </Card>
        )}

        {/* Trust footer */}
        <p className="text-center text-xs text-muted-foreground">
          {isComingSoon ? (
            <>Payments will be securely processed by <span className="font-medium text-foreground">Paystack</span> when billing launches. AGENTMARK never sees or stores your card details.</>
          ) : (
            <>Payments are securely processed by <span className="font-medium text-foreground">Paystack</span>. AGENTMARK never sees or stores your card details.</>
          )}
        </p>
      </div>
    </div>
  );
}
