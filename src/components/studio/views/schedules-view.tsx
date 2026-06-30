"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Loader2,
  Trash2,
  Check,
  CircleDot,
  Play,
  Webhook,
  Copy,
  ExternalLink,
  ChevronDown,
  Settings2,
  Zap,
  Send,
  ShieldCheck,
  Filter,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---- Domain types -----------------------------------------------------------

interface Schedule {
  id: string;
  agentId: string;
  cron: string;
  timezone: string;
  input: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string;
  nextRunAt: string | null;
  humanCron: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookTrigger {
  id: string;
  agentId: string;
  token: string;
  hasSecret: boolean;
  secret: string;
  filterExpr: string;
  inputTemplate: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  webhookUrl: string;
  createdAt: string;
}

// ---- Static option lists ----------------------------------------------------

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every 30 minutes", cron: "*/30 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Daily at 9am", cron: "0 9 * * *" },
  { label: "Daily at midnight", cron: "0 0 * * *" },
  { label: "Every Monday 9am", cron: "0 9 * * 1" },
  { label: "Weekdays 9am", cron: "0 9 * * 1-5" },
  { label: "First of month", cron: "0 0 1 * *" },
];

const TZ_PRESETS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ---- Main view --------------------------------------------------------------

export function SchedulesView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();

  const [tab, setTab] = useState<"schedules" | "webhooks">("schedules");

  // ---------- Empty state (no active agent) ----------
  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center">
          <Card className="w-full">
            <CardHeader className="items-center gap-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Clock className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Select an agent to manage schedules</CardTitle>
              <CardDescription>
                Choose an agent to set up cron-based schedules and webhook triggers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">No agents yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first agent to start scheduling.
                  </p>
                </div>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto studio-scroll">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setActiveAgent(a)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                        <Icon name={a.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.name}</div>
                        {a.description ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {a.description}
                          </div>
                        ) : null}
                      </div>
                      <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-center">
              <Button
                onClick={() => {
                  useStudio.getState().setActiveAgent(null);
                  useStudio.getState().setGraph([], []);
                  useStudio.getState().setNewAgentRequested(true);
                  setView("studio");
                }}
              >
                <Plus className="h-4 w-4" />
                New agent
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Header */}
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon name={activeAgent.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight sm:text-xl">
              {activeAgent.name}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Auto-run this agent on a schedule, or trigger it via webhook
            </p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "schedules" | "webhooks")}>
        <TabsList>
          <TabsTrigger value="schedules">
            <Clock className="h-3.5 w-3.5" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="h-3.5 w-3.5" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          <SchedulesTab agentId={activeAgent.id} />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab agentId={activeAgent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Schedules tab
// ============================================================================

function SchedulesTab({ agentId }: { agentId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/schedules`, { cache: "no-store" });
      if (res.ok) {
        setSchedules(await res.json());
      } else {
        setSchedules([]);
      }
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleToggle(schedule: Schedule, enabled: boolean) {
    // optimistic
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)),
    );
    setTogglingId(schedule.id);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/schedules/${schedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(`Schedule ${enabled ? "enabled" : "paused"}`);
    } catch {
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, enabled: !enabled } : s)),
      );
      toast.error("Failed to update schedule");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(schedule: Schedule) {
    setDeletingId(schedule.id);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/schedules/${schedule.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Schedule deleted");
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch {
      toast.error("Failed to delete schedule");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRunNow(schedule: Schedule) {
    setRunningId(schedule.id);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/schedules/${schedule.id}`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Run failed");
      if (data.status === "success") {
        toast.success("Schedule ran successfully", {
          description: data.output
            ? data.output.slice(0, 200)
            : "Agent finished without output.",
        });
      } else {
        toast.error("Schedule run failed", {
          description: data.output?.slice(0, 200) ?? "",
        });
      }
      // Refresh to pick up lastRunAt / nextRunAt changes
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Cron schedules</h3>
          <p className="text-xs text-muted-foreground">
            Up to 10 per agent · Runs at most every minute
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm font-medium">No schedules yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Add a cron schedule to auto-run this agent on a recurring basis.
              Pairs well with knowledge nodes, web-search tools, and HTTP requests.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add your first schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <ScheduleRow
              key={s.id}
              schedule={s}
              toggling={togglingId === s.id}
              deleting={deletingId === s.id}
              running={runningId === s.id}
              onToggle={(en) => handleToggle(s, en)}
              onDelete={() => handleDelete(s)}
              onRunNow={() => handleRunNow(s)}
            />
          ))}
        </div>
      )}

      <AddScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agentId={agentId}
        onCreated={() => {
          setDialogOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

function ScheduleRow({
  schedule,
  toggling,
  deleting,
  running,
  onToggle,
  onDelete,
  onRunNow,
}: {
  schedule: Schedule;
  toggling: boolean;
  deleting: boolean;
  running: boolean;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              schedule.enabled
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{schedule.humanCron}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                {schedule.cron}
              </code>
              {schedule.timezone !== "UTC" && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  {schedule.timezone}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {schedule.nextRunAt ? (
                <span>
                  Next: {formatDistanceToNow(new Date(schedule.nextRunAt), { addSuffix: true })}
                </span>
              ) : schedule.enabled ? (
                <span>Next: computing…</span>
              ) : (
                <span className="text-muted-foreground/70">Paused</span>
              )}
              {schedule.lastRunAt && (
                <span>
                  Last: {formatDistanceToNow(new Date(schedule.lastRunAt), { addSuffix: true })}
                </span>
              )}
              {schedule.lastRunStatus === "success" && (
                <Badge className="border-transparent bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-500">
                  <Check className="h-2.5 w-2.5" />
                  ok
                </Badge>
              )}
              {schedule.lastRunStatus === "error" && (
                <Badge className="border-transparent bg-red-500/15 px-1.5 py-0 text-[10px] text-red-500">
                  error
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onRunNow}
            disabled={running}
            className="gap-1.5"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run now
          </Button>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={onToggle}
            disabled={toggling}
            aria-label={schedule.enabled ? "Pause schedule" : "Enable schedule"}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete schedule"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddScheduleDialog({
  open,
  onOpenChange,
  agentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agentId: string;
  onCreated: () => void;
}) {
  const [cron, setCron] = useState("* * * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [input, setInput] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  function applyPreset(c: string) {
    setCron(c);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron, timezone, input, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create schedule");
      }
      toast.success("Schedule created");
      // Reset for next time
      setCron("* * * * *");
      setTimezone("UTC");
      setInput("");
      setEnabled(true);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add schedule</DialogTitle>
          <DialogDescription>
            Run this agent automatically on a recurring schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cron expression</Label>
            <Input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="* * * * *"
              className="font-mono"
            />
            <div className="flex flex-wrap gap-1">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  onClick={() => applyPreset(p.cron)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                    cron === p.cron
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="UTC" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TZ_PRESETS.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched-input">Static input (optional)</Label>
            <Textarea
              id="sched-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Summarize today's news about AI"
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">
              Fed to the agent on every scheduled run. Leave blank to use the default.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <p className="text-[11px] text-muted-foreground">
                Pause without deleting the schedule.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || !cron.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Webhooks tab
// ============================================================================

function WebhooksTab({ agentId }: { agentId: string }) {
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [zapierOpen, setZapierOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/triggers`, { cache: "no-store" });
      if (res.ok) {
        setTriggers(await res.json());
      } else {
        setTriggers([]);
      }
    } catch {
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleToggle(trigger: WebhookTrigger, enabled: boolean) {
    setTriggers((prev) =>
      prev.map((t) => (t.id === trigger.id ? { ...t, enabled } : t)),
    );
    setTogglingId(trigger.id);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/triggers/${trigger.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(`Webhook ${enabled ? "enabled" : "disabled"}`);
    } catch {
      setTriggers((prev) =>
        prev.map((t) => (t.id === trigger.id ? { ...t, enabled: !enabled } : t)),
      );
      toast.error("Failed to update webhook");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(trigger: WebhookTrigger) {
    setDeletingId(trigger.id);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/triggers/${trigger.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Webhook deleted");
      setTriggers((prev) => prev.filter((t) => t.id !== trigger.id));
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTest(trigger: WebhookTrigger) {
    setTestingId(trigger.id);
    try {
      const res = await fetch(trigger.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          message: "Hello from AGENTMARK — this is a test webhook payload.",
          from: "agentmark-test",
          at: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        toast.success("Webhook fired successfully", {
          description: data.output
            ? data.output.slice(0, 200)
            : "Agent finished without output.",
        });
      } else if (res.status === 202) {
        toast.success("Webhook accepted — agent running in background");
      } else {
        toast.error(`Webhook test failed (HTTP ${res.status})`, {
          description: data.error ?? data.message ?? "",
        });
      }
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Webhook triggers</h3>
          <p className="text-xs text-muted-foreground">
            Up to 5 per agent · External systems can POST a payload to fire this agent
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : triggers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Webhook className="h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm font-medium">No webhook triggers yet</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Create a webhook trigger to get a unique URL. Any system that can
              send an HTTP POST (Zapier, Make.com, GitHub, Stripe, IFTTT, custom
              code) can fire this agent.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add your first webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {triggers.map((t) => (
            <WebhookRow
              key={t.id}
              trigger={t}
              toggling={togglingId === t.id}
              deleting={deletingId === t.id}
              testing={testingId === t.id}
              onToggle={(en) => handleToggle(t, en)}
              onDelete={() => handleDelete(t)}
              onTest={() => handleTest(t)}
            />
          ))}
        </div>
      )}

      {/* Zapier / Make.com integration guide */}
      <Collapsible open={zapierOpen} onOpenChange={setZapierOpen} className="rounded-lg border border-border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Connect to Zapier / Make.com</div>
              <p className="text-[11px] text-muted-foreground">
                Step-by-step instructions for wiring this agent into a no-code automation.
              </p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", zapierOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4 space-y-4">
            {triggers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Create a webhook trigger first to get a URL to paste into Zapier / Make.
              </p>
            ) : (
              <>
                <ZapierGuide webhookUrl={triggers[0].webhookUrl} />
                <Separator />
                <MakeGuide webhookUrl={triggers[0].webhookUrl} />
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AddWebhookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agentId={agentId}
        onCreated={() => {
          setDialogOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

function WebhookRow({
  trigger,
  toggling,
  deleting,
  testing,
  onToggle,
  onDelete,
  onTest,
}: {
  trigger: WebhookTrigger;
  toggling: boolean;
  deleting: boolean;
  testing: boolean;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(trigger.webhookUrl);
      setCopied(true);
      toast.success("Webhook URL copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy URL");
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  trigger.enabled
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Webhook className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Webhook</span>
              {trigger.hasSecret && (
                <Badge variant="outline" className="gap-1 text-[10px] text-emerald-500">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  signed
                </Badge>
              )}
              {trigger.filterExpr && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Filter className="h-2.5 w-2.5" />
                  filter
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                {trigger.triggerCount} {trigger.triggerCount === 1 ? "call" : "calls"}
              </Badge>
              {trigger.lastTriggeredAt && (
                <span className="text-[11px] text-muted-foreground">
                  last {formatDistanceToNow(new Date(trigger.lastTriggeredAt), { addSuffix: true })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <code className="block flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground/90">
                {trigger.webhookUrl}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={copyUrl}
                aria-label="Copy webhook URL"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {trigger.inputTemplate && trigger.inputTemplate !== "{{payload}}" && (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-mono">template:</span>{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{trigger.inputTemplate}</code>
              </div>
            )}
            {trigger.filterExpr && (
              <div className="text-[11px] text-muted-foreground">
                <span className="font-mono">filter:</span>{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{trigger.filterExpr}</code>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={onTest} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Test
            </Button>
            <Switch
              checked={trigger.enabled}
              onCheckedChange={onToggle}
              disabled={toggling}
              aria-label={trigger.enabled ? "Disable webhook" : "Enable webhook"}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={deleting}
              aria-label="Delete webhook"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddWebhookDialog({
  open,
  onOpenChange,
  agentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agentId: string;
  onCreated: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [filterExpr, setFilterExpr] = useState("");
  const [inputTemplate, setInputTemplate] = useState("{{payload}}");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secret.trim() || undefined,
          filterExpr: filterExpr.trim() || undefined,
          inputTemplate: inputTemplate.trim() || "{{payload}}",
          enabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }
      toast.success("Webhook created", {
        description: "Copy the URL — you won't see the token in full again.",
      });
      // Reset
      setSecret("");
      setFilterExpr("");
      setInputTemplate("{{payload}}");
      setEnabled(true);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add webhook trigger</DialogTitle>
          <DialogDescription>
            Generates a unique URL that runs this agent when hit with a POST request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wh-secret">Signing secret (optional)</Label>
            <Input
              id="wh-secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="leave blank to skip HMAC verification"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              If set, callers must send <code className="font-mono">X-Webhook-Signature</code> as
              the hex HMAC-SHA256 of the raw body using this secret.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-filter">Filter expression (optional, JMESPath)</Label>
            <Input
              id="wh-filter"
              value={filterExpr}
              onChange={(e) => setFilterExpr(e.target.value)}
              placeholder='e.g. event == "order.created"'
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Evaluated against the parsed JSON body. The agent only fires when truthy.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-tpl">Input template</Label>
            <Textarea
              id="wh-tpl"
              value={inputTemplate}
              onChange={(e) => setInputTemplate(e.target.value)}
              placeholder="{{payload}}"
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Maps the webhook payload to the agent input. Use{" "}
              <code className="font-mono">{"{{payload}}"}</code> for the whole body, or{" "}
              <code className="font-mono">{"{{payload.message.text}}"}</code> for a sub-field.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <p className="text-[11px] text-muted-foreground">
                Disable to pause the trigger without deleting it.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Zapier / Make.com integration guides
// ============================================================================

function ZapierGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Zapier</h4>
        <a
          href="https://zapier.com/apps/webhook/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Zapier docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
        <li>In Zapier, create a new Zap.</li>
        <li>Choose a trigger (e.g. <em>New Gmail email</em>, <em>New Stripe charge</em>, <em>New GitHub issue</em>).</li>
        <li>Add an action step → search for <strong>Webhooks by Zapier</strong> → choose <strong>POST</strong>.</li>
        <li>
          Paste this URL into the <em>URL</em> field:
          <code className="mt-1 block w-full break-all rounded bg-muted px-2 py-1 font-mono text-[10px]">
            {webhookUrl}
          </code>
        </li>
        <li>Set <em>Payload Type</em> to <code className="font-mono">JSON</code> and configure the body.</li>
        <li>If you set a signing secret, add a header <code className="font-mono">X-Webhook-Signature</code> with the HMAC-SHA256 hex digest of the body.</li>
        <li>Test the Zap. If it returns 200, your agent ran successfully. 202 means it's running in the background.</li>
        <li>Publish the Zap.</li>
      </ol>
    </div>
  );
}

function MakeGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Make.com</h4>
        <a
          href="https://www.make.com/en/help/tools/http"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Make docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
        <li>In Make.com, create a new Scenario.</li>
        <li>Add your trigger module (e.g. <em>Google Sheets → Watch Rows</em>, <em>Mailhook</em>, <em>Webhooks</em>).</li>
        <li>Add an <strong>HTTP → Make a request</strong> module.</li>
        <li>
          Set the URL to:
          <code className="mt-1 block w-full break-all rounded bg-muted px-2 py-1 font-mono text-[10px]">
            {webhookUrl}
          </code>
        </li>
        <li>Set Method = <code className="font-mono">POST</code> and Body type = <code className="font-mono">JSON</code>.</li>
        <li>Map the trigger module's output into the JSON body.</li>
        <li>If you set a signing secret, add a header <code className="font-mono">X-Webhook-Signature</code> with the HMAC-SHA256 hex digest of the raw body.</li>
        <li>Run once to test. Status 200 = success, 202 = running in background.</li>
        <li>Turn the scenario ON to go live.</li>
      </ol>
    </div>
  );
}
