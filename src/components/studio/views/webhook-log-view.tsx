"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Webhook, RefreshCw, Loader2, ArrowDown, ArrowUp, CheckCircle2,
  XCircle, Clock, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface WebhookEvent {
  id: string;
  integrationId: string;
  platform: string;
  agentId: string;
  direction: string;
  senderName: string;
  senderId: string;
  content: string;
  status: string;
  tokens: number;
  costCents: number;
  durationMs: number;
  createdAt: string;
}

interface LogData {
  events: WebhookEvent[];
  total: number;
  offset: number;
  limit: number;
  platforms: string[];
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: "✈️",
  whatsapp: "💬",
  slack: "#️⃣",
  discord: "🎮",
  email: "📧",
  voice: "📞",
  sms: "📱",
  web: "🌐",
  api: "🔌",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  delivered: { icon: CheckCircle2, color: "text-emerald-500" },
  failed: { icon: XCircle, color: "text-red-500" },
  pending: { icon: Clock, color: "text-amber-500" },
};

export function WebhookLogView() {
  const { user } = useAuth();
  const { setView } = useStudio();
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("all");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        uid: user.firebaseUid,
        limit: "50",
        offset: String(offset),
      });
      if (platform !== "all") params.set("platform", platform);
      const res = await fetch(`/api/webhooks/log?${params}`);
      if (res.ok) {
        setData((await res.json()) as LogData);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user, platform, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset offset when platform changes
  useEffect(() => {
    setOffset(0);
  }, [platform]);

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Webhook className="h-5 w-5 text-primary" />
                Webhook Event Log
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Every incoming + outgoing message across all your integrations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {(data?.platforms || []).map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={load} disabled={loading} variant="outline" size="sm" className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats */}
        {data && data.events.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Total events</div>
              <div className="mt-1 text-lg font-semibold">{data.total}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Incoming</div>
              <div className="mt-1 text-lg font-semibold text-blue-500">
                {data.events.filter((e) => e.direction === "incoming").length}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Outgoing</div>
              <div className="mt-1 text-lg font-semibold text-emerald-500">
                {data.events.filter((e) => e.direction === "outgoing").length}
              </div>
            </Card>
          </div>
        )}

        {/* Events */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : !data || data.events.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Webhook className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-semibold">No webhook events yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Connect an integration (Telegram, WhatsApp, Slack, etc.) and send it a message. Events will appear here.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setView("integrations")}>
              Go to Integrations <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {data.events.map((event) => {
                const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.delivered;
                const StatusIcon = statusCfg.icon;
                const isIncoming = event.direction === "incoming";
                return (
                  <Card key={event.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                        isIncoming ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500",
                      )}>
                        {isIncoming ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {PLATFORM_ICONS[event.platform] || "🔗"} {event.platform}
                          </Badge>
                          <span className="text-xs font-medium">
                            {isIncoming ? "From" : "To"}: {event.senderName || event.senderId || "unknown"}
                          </span>
                          <span className={cn("flex items-center gap-0.5 text-xs", statusCfg.color)}>
                            <StatusIcon className="h-3 w-3" /> {event.status}
                          </span>
                          {event.tokens > 0 && (
                            <span className="text-xs text-muted-foreground">{event.tokens} tok</span>
                          )}
                          {event.durationMs > 0 && (
                            <span className="text-xs text-muted-foreground">{event.durationMs}ms</span>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {event.content && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 font-mono">
                            {event.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {data.total > data.limit && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - data.limit))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {offset + 1}–{Math.min(offset + data.limit, data.total)} of {data.total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + data.limit >= data.total}
                  onClick={() => setOffset(offset + data.limit)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
