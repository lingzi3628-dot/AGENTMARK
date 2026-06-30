"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Play,
  Zap,
  Clock,
  CheckCircle2,
  BarChart3,
  Crown,
  Cpu,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { formatTokens } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface AnalyticsData {
  totals: {
    runs: number;
    tokens: number;
    avgDurationMs: number;
    successRate: number;
  };
  daily: { date: string; tokens: number; runs: number }[];
  perAgent: {
    agentId: string;
    agentName: string;
    runs: number;
    tokens: number;
    lastRunAt: string;
  }[];
  perIntegration: {
    platform: string;
    incoming: number;
    outgoing: number;
    tokens: number;
  }[];
  plan: {
    name: string;
    dailyTokenLimit: number;
    maxAgents: number;
    tokensUsedToday: number;
    agentCount: number;
  };
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

const tooltipLabelStyle = { color: "var(--foreground)" } as const;

export function AnalyticsView() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.firebaseUid) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics?uid=${user.firebaseUid}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        const json = (await res.json()) as AnalyticsData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load analytics. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.firebaseUid]);

  if (loading) return <AnalyticsSkeleton />;

  if (error || !data) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {error || "No analytics data available."}
          </p>
        </Card>
      </div>
    );
  }

  // Empty state — no runs and no integration messages
  const isEmpty =
    data.totals.runs === 0 &&
    data.perAgent.length === 0 &&
    data.perIntegration.length === 0;

  if (isEmpty) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <Card className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No runs yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Execute an agent to see analytics
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const tokenPct = Math.min(
    100,
    Math.round((data.plan.tokensUsedToday / Math.max(1, data.plan.dailyTokenLimit)) * 100),
  );
  const agentPct = Math.min(
    100,
    Math.round((data.plan.agentCount / Math.max(1, data.plan.maxAgents)) * 100),
  );

  const integrationTotals = data.perIntegration.reduce(
    (acc, p) => {
      acc.incoming += p.incoming;
      acc.outgoing += p.outgoing;
      acc.tokens += p.tokens;
      return acc;
    },
    { incoming: 0, outgoing: 0, tokens: 0 },
  );

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Play}
            label="Total runs (30d)"
            value={data.totals.runs.toLocaleString()}
            accent="primary"
          />
          <StatCard
            icon={Zap}
            label="Total tokens (30d)"
            value={formatTokens(data.totals.tokens)}
            accent="primary"
          />
          <StatCard
            icon={Clock}
            label="Avg duration"
            value={
              data.totals.avgDurationMs >= 1000
                ? `${(data.totals.avgDurationMs / 1000).toFixed(1)}s`
                : `${data.totals.avgDurationMs}ms`
            }
            accent="muted"
          />
          <StatCard
            icon={CheckCircle2}
            label="Success rate"
            value={`${Math.round(data.totals.successRate * 100)}%`}
            accent="accent"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Token usage (last 30 days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.daily} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="tokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value: number) => [formatTokens(value), "Tokens"]}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="var(--primary)"
                  fill="url(#tokGrad)"
                  strokeWidth={2}
                  fillOpacity={0.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Runs per day (last 30 days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.daily} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }}
                  formatter={(value: number) => [value, "Runs"]}
                />
                <Bar
                  dataKey="runs"
                  fill="var(--primary)"
                  fillOpacity={0.8}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top agents */}
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Top agents by usage</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {data.perAgent.length} of 10
              </span>
            </div>
            {data.perAgent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No agent runs in the last 30 days.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Last run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perAgent.map((a) => (
                    <TableRow key={a.agentId}>
                      <TableCell className="max-w-[160px] truncate font-medium">
                        {a.agentName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.runs}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTokens(a.tokens)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.lastRunAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Integration messages */}
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Integration messages</h3>
              <span className="ml-auto text-xs text-muted-foreground">last 30 days</span>
            </div>
            {data.perIntegration.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No integration messages in the last 30 days.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Incoming</TableHead>
                    <TableHead className="text-right">Outgoing</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.perIntegration.map((p) => (
                    <TableRow key={p.platform}>
                      <TableCell className="font-medium capitalize">{p.platform}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.incoming}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.outgoing}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatTokens(p.tokens)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {integrationTotals.incoming}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {integrationTotals.outgoing}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatTokens(integrationTotals.tokens)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </Card>
        </div>

        {/* Plan & limits */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Plan &amp; limits</h3>
            <Badge
              className={cn(
                "ml-auto gap-1",
                data.plan.name === "free"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/15 text-primary",
              )}
            >
              <Crown className="h-3 w-3" />
              {data.plan.name.toUpperCase()}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Daily tokens */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" /> Daily tokens
                </span>
                <span className="text-muted-foreground">
                  {formatTokens(data.plan.tokensUsedToday)} /{" "}
                  {formatTokens(data.plan.dailyTokenLimit)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    tokenPct > 80 ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {tokenPct}% of daily token limit used today.
              </p>
            </div>

            {/* Agents */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-primary" /> Agents
                </span>
                <span className="text-muted-foreground">
                  {data.plan.agentCount} / {data.plan.maxAgents}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    agentPct > 80 ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${agentPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {agentPct}% of agent slots in use.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: IconCmp,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: "primary" | "accent" | "muted";
}) {
  const tones = {
    primary: "bg-primary/12 text-primary",
    accent: "bg-accent text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[accent])}>
        <IconCmp className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
