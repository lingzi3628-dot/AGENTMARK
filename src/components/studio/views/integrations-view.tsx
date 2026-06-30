"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Plug,
  Plus,
  Loader2,
  Settings2,
  Trash2,
  Check,
  CircleDot,
  BookOpen,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { PLATFORMS } from "@/lib/constants";
import type { Integration } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function IntegrationsView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPlatform, setDialogPlatform] = useState<string | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showProcedure, setShowProcedure] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async (agentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/integrations`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Integration[];
        setIntegrations(data);
      } else {
        setIntegrations([]);
      }
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeAgent) {
      void fetchIntegrations(activeAgent.id);
    } else {
      setIntegrations([]);
    }
  }, [activeAgent, fetchIntegrations]);

  const byPlatform = useMemo(() => {
    const m = new Map<string, Integration>();
    for (const it of integrations) m.set(it.platform, it);
    return m;
  }, [integrations]);

  const dialogPlatformDef = dialogPlatform
    ? PLATFORMS.find((p) => p.id === dialogPlatform) ?? null
    : null;

  const guidePlatformDef = guidePlatform
    ? PLATFORMS.find((p) => p.id === guidePlatform) ?? null
    : null;

  function openConnect(platformId: string) {
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (!platform) return;
    const init: Record<string, string> = {};
    for (const f of platform.fields) init[f.key] = "";
    setConfigValues(init);
    setEditingIntegration(null);
    setDialogPlatform(platformId);
    setDialogOpen(true);
  }

  function openManage(integration: Integration) {
    const platform = PLATFORMS.find((p) => p.id === integration.platform);
    if (!platform) return;
    const init: Record<string, string> = {};
    for (const f of platform.fields) init[f.key] = integration.config[f.key] ?? "";
    setConfigValues(init);
    setEditingIntegration(integration);
    setDialogPlatform(integration.platform);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setDialogPlatform(null);
    setEditingIntegration(null);
    setShowProcedure(false);
  }

  async function handleSave() {
    if (!activeAgent || !dialogPlatformDef) return;
    setSaving(true);
    try {
      if (editingIntegration) {
        const res = await fetch(`/api/integrations/${editingIntegration.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: configValues }),
        });
        if (!res.ok) throw new Error("Failed to update integration");
        toast.success(`${dialogPlatformDef.name} configuration saved`);
      } else {
        const res = await fetch(`/api/agents/${activeAgent.id}/integrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: dialogPlatformDef.id, config: configValues }),
        });
        if (!res.ok) throw new Error("Failed to connect");
        const data = await res.json();
        // Show setup status if the platform did auto-setup (e.g. Telegram webhook)
        if (data.setup) {
          if (data.setup.ok) {
            toast.success(data.setup.message || `Connected to ${dialogPlatformDef.name}`);
          } else {
            toast.error(data.setup.message || `Connected, but setup had an issue`);
          }
        } else {
          toast.success(`Connected to ${dialogPlatformDef.name}`);
        }
      }
      await fetchIntegrations(activeAgent.id);
      closeDialog();
    } catch {
      toast.error(
        editingIntegration
          ? "Failed to save configuration"
          : `Failed to connect to ${dialogPlatformDef.name}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect(integration: Integration) {
    if (!activeAgent) return;
    const platform = PLATFORMS.find((p) => p.id === integration.platform);
    setDisconnectingId(integration.id);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success(`Disconnected from ${platform?.name ?? "platform"}`);
      await fetchIntegrations(activeAgent.id);
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnectingId(null);
    }
  }

  async function handleToggle(integration: Integration, enabled: boolean) {
    if (!activeAgent) return;
    // optimistic
    setIntegrations((prev) =>
      prev.map((i) => (i.id === integration.id ? { ...i, enabled } : i)),
    );
    setTogglingId(integration.id);
    try {
      const res = await fetch(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      const platform = PLATFORMS.find((p) => p.id === integration.platform);
      toast.success(
        `${platform?.name ?? "Platform"} ${enabled ? "enabled" : "disabled"}`,
      );
    } catch {
      // rollback
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? { ...i, enabled: !enabled } : i)),
      );
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  }

  function handleNewAgent() {
    useStudio.getState().setActiveAgent(null);
    useStudio.getState().setGraph([], []);
    useStudio.getState().setNewAgentRequested(true);
    setView("studio");
  }

  // ---------------- No active agent: picker ----------------
  if (!activeAgent) {
    return (
      <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center">
          <Card className="w-full">
            <CardHeader className="items-center gap-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Plug className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Select an agent to connect</CardTitle>
              <CardDescription>
                Choose an agent to manage its channel integrations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">No agents yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first agent to start connecting channels.
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
              <Button onClick={handleNewAgent}>
                <Plus className="h-4 w-4" />
                New agent
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const connectedCount = integrations.length;

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon name={activeAgent.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-tight sm:text-xl">
              {activeAgent.name}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Connect this agent to your channels
            </p>
          </div>
        </div>
        <Badge className="border-transparent bg-primary/15 text-primary">
          <Check className="h-3 w-3" />
          {connectedCount} connected
        </Badge>
      </header>

      {/* Platform grid */}
      <section aria-label="Available platforms">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const integration = byPlatform.get(platform.id);
            const connected = Boolean(integration);
            const isDisconnecting = disconnectingId === integration?.id;
            return (
              <Card key={platform.id} className="gap-0 py-0">
                <CardHeader className="gap-3 px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        platform.color,
                      )}
                    >
                      <Icon name={platform.icon} className="h-5 w-5" />
                    </div>
                    {connected ? (
                      <Badge className="border-transparent bg-emerald-500/15 text-emerald-500">
                        <Check className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not connected
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-sm">{platform.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {platform.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardFooter className="flex items-center gap-2 border-t border-border/60 px-4 py-3">
                  {connected && integration ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openManage(integration)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => { setGuidePlatform(platform.id); }}
                        aria-label={`How to connect ${platform.name}`}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Guide
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDisconnect(integration)}
                        disabled={isDisconnecting}
                        aria-label={`Disconnect ${platform.name}`}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => openConnect(platform.id)}>
                        <Plug className="h-3.5 w-3.5" />
                        Connect
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => { setGuidePlatform(platform.id); }}
                        aria-label={`How to connect ${platform.name}`}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Guide
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Loading skeleton */}
        {loading && integrations.length === 0 ? null : null}
      </section>

      {/* Connected integrations list */}
      <section aria-label="Connected integrations" className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold">Connected integrations</h3>
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{connectedCount} total</span>
        </div>

        {loading && integrations.length === 0 ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : integrations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Plug className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-medium">No integrations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect a platform above to start receiving messages.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {integrations.map((integration) => {
              const platform = PLATFORMS.find((p) => p.id === integration.platform);
              if (!platform) return null;
              const isToggling = togglingId === integration.id;
              const switchId = `switch-${integration.id}`;
              return (
                <li
                  key={integration.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      platform.color,
                    )}
                  >
                    <Icon name={platform.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{platform.name}</span>
                      {!integration.enabled ? (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Disabled
                        </Badge>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Connected{" "}
                      {formatDistanceToNow(new Date(integration.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={switchId}
                      className="sr-only"
                    >
                      {integration.enabled ? "Disable" : "Enable"} {platform.name}
                    </Label>
                    <Switch
                      id={switchId}
                      checked={integration.enabled}
                      disabled={isToggling}
                      onCheckedChange={(checked) => handleToggle(integration, checked)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => openManage(integration)}
                      aria-label={`Manage ${platform.name}`}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Config / Manage dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogPlatformDef ? (
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md",
                    dialogPlatformDef.color,
                  )}
                >
                  <Icon name={dialogPlatformDef.icon} className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {editingIntegration
                ? `Manage ${dialogPlatformDef?.name ?? ""}`
                : `Connect ${dialogPlatformDef?.name ?? ""}`}
            </DialogTitle>
            <DialogDescription>
              {dialogPlatformDef?.description ?? ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogPlatformDef?.fields.map((field) => {
              const fieldId = `field-${field.key}`;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={fieldId}>{field.label}</Label>
                  <Input
                    id={fieldId}
                    type={field.type === "password" ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={configValues[field.key] ?? ""}
                    onChange={(e) =>
                      setConfigValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </div>
              );
            })}

            {/* How to connect — collapsible procedure */}
            {dialogPlatformDef?.procedure && dialogPlatformDef.procedure.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setShowProcedure((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <BookOpen className="h-4 w-4 text-primary" />
                  How to connect {dialogPlatformDef.name}
                  <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", showProcedure && "rotate-180")} />
                </button>
                {showProcedure && (
                  <div className="max-h-64 overflow-y-auto studio-scroll border-t border-border px-3 py-2">
                    <ol className="space-y-2.5">
                      {dialogPlatformDef.procedure.map((step, i) => (
                        <li key={i} className="flex gap-2.5 text-xs">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{step.title}</p>
                            <p className="mt-0.5 text-muted-foreground">{step.body}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {dialogPlatformDef.docsUrl && (
                      <a
                        href={dialogPlatformDef.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Official {dialogPlatformDef.name} documentation
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingIntegration ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {editingIntegration ? "Save" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standalone Guide dialog — shows full setup procedure */}
      <Dialog
        open={guidePlatform !== null}
        onOpenChange={(o) => { if (!o) setGuidePlatform(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {guidePlatformDef ? (
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md",
                    guidePlatformDef.color,
                  )}
                >
                  <Icon name={guidePlatformDef.icon} className="h-3.5 w-3.5" />
                </span>
              ) : null}
              How to connect {guidePlatformDef?.name ?? ""}
            </DialogTitle>
            <DialogDescription>
              {guidePlatformDef?.description ?? ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto studio-scroll">
            <ol className="space-y-3">
              {guidePlatformDef?.procedure.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {guidePlatformDef?.docsUrl && (
              <a
                href={guidePlatformDef.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary/8 px-3 py-2 text-xs text-primary hover:bg-primary/12"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Read the official {guidePlatformDef.name} documentation
              </a>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuidePlatform(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (guidePlatform) {
                  setGuidePlatform(null);
                  openConnect(guidePlatform);
                }
              }}
              className="gap-1.5"
            >
              <Plug className="h-4 w-4" />
              Connect now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
