"use client";

import { Crown, Sparkles, Check, Zap, Cpu } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BillingView() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Crown className="h-5 w-5 text-primary" />
              Your Plan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AGENTMARK is free and open source. No paid plans — all features included.
            </p>
          </div>
          <Badge className="gap-1.5 bg-primary/15 text-primary px-3 py-1">
            <Crown className="h-3.5 w-3.5" />
            Free Forever
          </Badge>
        </div>

        {/* Free plan card */}
        <Card className="relative overflow-hidden border-primary/30 p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">AGENTMARK Free</h3>
                <p className="text-2xl font-bold mt-1">$0<span className="text-sm font-normal text-muted-foreground">/forever</span></p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everything you need to build, run, and ship AI agents. Open source under MIT license.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                "2 agents",
                "100K tokens/day",
                "All 12 node types",
                "2 integrations per agent",
                "2 webhook triggers per agent",
                "2 schedules per agent",
                "All 9 integration platforms",
                "Local model support (Ollama, LM Studio)",
                "RAG over uploaded docs",
                "Real-time collaboration",
                "Agent versioning + branching",
                "Templates marketplace",
                "Public REST API + JS SDK",
                "Custom JS code nodes",
                "Human-in-the-loop approvals",
                "Mobile PWA (offline + installable)",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Usage */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-primary" /> Your Usage
          </h3>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> Daily tokens</span>
                <span className="text-muted-foreground">{user.tokensUsedToday.toLocaleString()} / {user.dailyTokenLimit.toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (user.tokensUsedToday / user.dailyTokenLimit) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-primary" /> Agents</span>
                <span className="text-muted-foreground">{user.maxAgents} max</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Open source note */}
        <Card className="border-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground">
            AGENTMARK is <strong>100% open source</strong> under the MIT license.
            <br />Self-host for free, use local models, and customize everything.
          </p>
          <a
            href="https://github.com/lingzi3628-dot/AGENTMARK"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View on GitHub →
          </a>
        </Card>
      </div>
    </div>
  );
}
