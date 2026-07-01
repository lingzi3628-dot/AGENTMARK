"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Trash2, Power, Plug, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConnectedToken {
  id: string;
  provider: string;
  providerEmail: string;
  providerUserName: string;
  providerAvatar: string;
  scopes: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

interface AvailableProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  configured: boolean;
  envVar: string;
}

interface ConnectorsData {
  connected: ConnectedToken[];
  available: AvailableProvider[];
}

export function ConnectorsView() {
  const { user } = useAuth();
  const { setView } = useStudio();
  const [data, setData] = useState<ConnectorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/connectors?uid=${user.firebaseUid}`);
      if (res.ok) {
        setData((await res.json()) as ConnectorsData);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Check for success/error params in URL (from OAuth callback redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    if (success) {
      toast.success(`${success} connected successfully!`);
      window.history.replaceState({}, "", "/connectors");
      void load();
    }
    if (error) {
      toast.error(`Connection failed: ${error}`);
      window.history.replaceState({}, "", "/connectors");
    }
  }, [load]);

  async function connect(providerId: string) {
    if (!user) return;
    setConnecting(providerId);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: providerId, uid: user.firebaseUid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to start OAuth flow");
      }
      // Redirect the browser to the OAuth provider
      window.location.href = data.authUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
      setConnecting(null);
    }
  }

  async function disconnect(token: ConnectedToken) {
    if (!user) return;
    if (!confirm(`Disconnect ${token.provider}? You'll need to reconnect to use it in workflows.`)) return;
    try {
      const res = await fetch(`/api/connectors/${token.id}?uid=${user.firebaseUid}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(`${token.provider} disconnected`);
      void load();
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  async function toggleActive(token: ConnectedToken) {
    if (!user) return;
    try {
      const res = await fetch(`/api/connectors/${token.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !token.isActive, uid: user.firebaseUid }),
      });
      if (!res.ok) throw new Error();
      toast.success(token.isActive ? "Connector disabled" : "Connector enabled");
      void load();
    } catch {
      toast.error("Failed to toggle");
    }
  }

  if (!user) return null;

  const connectedByProvider = new Map(data?.connected.map((t) => [t.provider, t]));

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">OAuth Connectors</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                One-click connect to Google, GitHub, Slack, Notion, and more. Tokens are encrypted at rest and usable in HTTP Request nodes.
              </p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            {/* Provider grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data?.available.map((provider) => {
                const connected = connectedByProvider.get(provider.id);
                const isConnecting = connecting === provider.id;
                return (
                  <Card key={provider.id} className={cn("p-4 transition-all", connected?.isActive && "border-emerald-500/30")}>
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl", provider.color)}>
                        {provider.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{provider.name}</h3>
                          {connected?.isActive && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-500 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Connected
                            </Badge>
                          )}
                          {connected && !connected.isActive && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{provider.description}</p>

                        {connected?.isActive && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            {connected.providerAvatar && (
                              <img src={connected.providerAvatar} alt="" className="h-4 w-4 rounded-full" />
                            )}
                            <span className="truncate">{connected.providerUserName || connected.providerEmail}</span>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-1.5">
                          {!provider.configured ? (
                            <Button size="sm" variant="outline" disabled className="gap-1 text-xs">
                              <AlertCircle className="h-3 w-3" /> Not configured
                            </Button>
                          ) : connected ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs"
                                onClick={() => toggleActive(connected)}
                              >
                                <Power className="h-3 w-3" /> {connected.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                                onClick={() => disconnect(connected)}
                              >
                                <Trash2 className="h-3 w-3" /> Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 gap-1 text-xs"
                              disabled={isConnecting}
                              onClick={() => connect(provider.id)}
                            >
                              {isConnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plug className="h-3 w-3" />
                              )}
                              Connect
                            </Button>
                          )}
                        </div>

                        {!provider.configured && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground">
                            Set <code className="rounded bg-muted px-1 py-0.5 font-mono">{provider.envVar}</code> env var to enable.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Help card */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">How to use connectors in workflows</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Once connected, your OAuth tokens are available to HTTP Request nodes in any agent.
                    In the Studio, add an HTTP Request node and reference the token via{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{"{{oauth.google}}"}</code>{" "}
                    in the Headers field. AGENTMARK automatically injects the decrypted Bearer token at runtime.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1 text-xs"
                    onClick={() => setView("studio")}
                  >
                    Open Studio <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
