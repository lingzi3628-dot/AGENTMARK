"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertCircle,
  Clock, Loader2, RefreshCw, MessageSquare, Zap, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PLATFORMS } from "@/lib/constants";

interface MonIntegration {
  integrationId: string;
  platform: string;
  enabled: boolean;
  health: "active" | "inactive" | "error" | "unknown";
  healthDetail: string;
  stats: { incoming: number; outgoing: number; total: number };
  lastMessage: {
    direction: string;
    content: string;
    senderName: string;
    time: string;
  } | null;
  uptime: { created: string; ageMs: number; ageLabel: string };
}

export function MonitoringPanel({ agentId }: { agentId: string }) {
  const [data, setData] = useState<MonIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMonitoring = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/monitoring`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json.integrations);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchMonitoring();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchMonitoring, 15000);
    return () => clearInterval(interval);
  }, [fetchMonitoring]);

  function refresh() {
    setRefreshing(true);
    fetchMonitoring();
  }

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading monitoring data…</span>
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return null; // Don't show the panel if there are no integrations
  }

  const totalIncoming = data.reduce((s, d) => s + d.stats.incoming, 0);
  const totalOutgoing = data.reduce((s, d) => s + d.stats.outgoing, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Live Monitoring</h3>
        <Badge variant="secondary" className="gap-1 ml-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Auto-refresh 15s
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 gap-1.5 text-xs"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatBox icon={ArrowDownLeft} label="Messages received" value={totalIncoming} color="text-cyan-500" />
        <StatBox icon={ArrowUpRight} label="Replies sent" value={totalOutgoing} color="text-emerald-500" />
        <StatBox
          icon={CheckCircle2}
          label="Active connections"
          value={data.filter((d) => d.health === "active").length}
          color="text-primary"
        />
      </div>

      <Separator className="mb-4" />

      {/* Per-integration status */}
      <div className="space-y-3">
        {data.map((d) => {
          const platform = PLATFORMS.find((p) => p.id === d.platform);
          return (
            <div
              key={d.integrationId}
              className="rounded-lg border border-border bg-background/50 p-3"
            >
              <div className="flex items-center gap-2.5">
                {/* Platform icon */}
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", platform?.color || "bg-muted")}>
                  <Icon name={platform?.icon || "plug"} className="h-4 w-4" />
                </div>

                {/* Name + health */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{platform?.name || d.platform}</span>
                    <HealthBadge health={d.health} enabled={d.enabled} />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{d.healthDetail}</p>
                </div>

                {/* Message counts */}
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="flex items-center gap-1 text-xs font-medium text-cyan-500">
                      <ArrowDownLeft className="h-3 w-3" />
                      {d.stats.incoming}
                    </div>
                    <div className="text-[10px] text-muted-foreground">in</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <ArrowUpRight className="h-3 w-3" />
                      {d.stats.outgoing}
                    </div>
                    <div className="text-[10px] text-muted-foreground">out</div>
                  </div>
                </div>
              </div>

              {/* Last message + uptime */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                {d.lastMessage ? (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Last {d.lastMessage.direction}:
                    <span className="max-w-[200px] truncate text-foreground/70">
                      {d.lastMessage.content}
                    </span>
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(d.lastMessage.time), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Connected {d.uptime.ageLabel} ago · No messages yet
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatBox({ icon: IconCmp, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center gap-1.5">
        <IconCmp className={cn("h-4 w-4", color)} />
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function HealthBadge({ health, enabled }: { health: string; enabled: boolean }) {
  if (!enabled) {
    return <Badge variant="outline" className="bg-muted/40 text-muted-foreground">Disabled</Badge>;
  }
  switch (health) {
    case "active":
      return (
        <Badge className="gap-1 border-transparent bg-emerald-500/15 text-emerald-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Active
        </Badge>
      );
    case "error":
      return (
        <Badge className="gap-1 border-transparent bg-destructive/15 text-destructive">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    case "inactive":
      return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;
  }
}
