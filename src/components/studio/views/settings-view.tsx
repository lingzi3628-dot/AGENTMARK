"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  KeyRound, Database, BarChart3, Crown, LogOut, Loader2, Check, Save,
  Cpu, Zap, AlertTriangle, Trash2,
} from "lucide-react";
import { signOut } from "@/lib/firebase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatTokens } from "@/lib/tokens";

export function SettingsView() {
  const { user, setUser, signOut: clearAuth } = useAuth();
  const { agents, setAgents, setView } = useStudio();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    glmApiKey: "",
    openaiApiKey: "",
    anthropicApiKey: "",
    supabaseUrl: "",
    supabaseAnonKey: "",
  });
  const [agentCount, setAgentCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    setForm({
      glmApiKey: "",
      openaiApiKey: "",
      anthropicApiKey: "",
      supabaseUrl: user.supabaseUrl || "",
      supabaseAnonKey: "",
    });
    setAgentCount(agents.length);
  }, [user, agents.length]);

  if (!user) return null;

  const tokensUsed = user.tokensUsedToday;
  const tokenLimit = user.dailyTokenLimit;
  const tokenPct = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100));
  const agentLimit = user.maxAgents;
  const agentPct = Math.min(100, Math.round((agentCount / agentLimit) * 100));

  async function saveKeys() {
    setSaving(true);
    try {
      const body: Record<string, string> = { firebaseUid: user!.firebaseUid };
      // Only send non-empty fields (don't overwrite with empty)
      if (form.glmApiKey) body.glmApiKey = form.glmApiKey;
      if (form.openaiApiKey) body.openaiApiKey = form.openaiApiKey;
      if (form.anthropicApiKey) body.anthropicApiKey = form.anthropicApiKey;
      if (form.supabaseUrl) body.supabaseUrl = form.supabaseUrl;
      if (form.supabaseAnonKey) body.supabaseAnonKey = form.supabaseAnonKey;
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setUser({ ...user!, ...updated });
      toast.success("Settings saved");
      setForm((f) => ({ ...f, glmApiKey: "", openaiApiKey: "", anthropicApiKey: "", supabaseAnonKey: "" }));
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    clearAuth();
    toast.success("Signed out");
  }

  async function deleteIdleAgents() {
    // Delete agents older than 7 days with no runs (auto-cleanup)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const idle = agents.filter((a) => new Date(a.updatedAt).getTime() < sevenDaysAgo);
    if (idle.length === 0) {
      toast.info("No idle agents found");
      return;
    }
    for (const a of idle) {
      await fetch(`/api/agents/${a.id}`, { method: "DELETE" });
    }
    setAgents(agents.filter((a) => !idle.includes(a)));
    toast.success(`Deleted ${idle.length} idle agent${idle.length > 1 ? "s" : ""}`);
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Profile header */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-primary/30 bg-muted">
              {user.photoURL ? (
                 
                <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{user.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge className={cn("gap-1", user.plan === "free" ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}>
              <Crown className="h-3 w-3" />
              {user.plan.toUpperCase()}
            </Badge>
          </div>
        </Card>

        {/* Usage & Limits */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Usage & Limits</h3>
          </div>

          <div className="space-y-4">
            {/* Token usage */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> Daily tokens</span>
                <span className="text-muted-foreground">{formatTokens(tokensUsed)} / {formatTokens(tokenLimit)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", tokenPct > 80 ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${tokenPct}%` }}
                />
              </div>
              {tokenPct > 80 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Approaching daily limit — upgrade your plan for more.
                </p>
              )}
            </div>

            {/* Agent count */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-primary" /> Agents</span>
                <span className="text-muted-foreground">{agentCount} / {agentLimit}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", agentPct > 80 ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${agentPct}%` }}
                />
              </div>
              {agentPct >= 90 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Agent limit reached. Delete unused agents or upgrade.
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={deleteIdleAgents}>
              <Trash2 className="h-3.5 w-3.5" /> Clean up idle agents (7+ days)
            </Button>
          </div>
        </Card>

        {/* API Keys (BYOK) */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">API Keys (Bring Your Own)</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Provide your own API keys to use your own model quota. Keys are stored securely and used server-side only.
            Leave blank to use the default AGENTMARK quota.
          </p>
          <div className="space-y-3">
            <KeyField
              label="GLM API Key"
              value={form.glmApiKey}
              masked={user.glmApiKey ? `Stored: ${user.glmApiKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, glmApiKey: v }))}
            />
            <KeyField
              label="OpenAI API Key"
              value={form.openaiApiKey}
              masked={user.openaiApiKey ? `Stored: ${user.openaiApiKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, openaiApiKey: v }))}
            />
            <KeyField
              label="Anthropic API Key"
              value={form.anthropicApiKey}
              masked={user.anthropicApiKey ? `Stored: ${user.anthropicApiKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, anthropicApiKey: v }))}
            />
          </div>
        </Card>

        {/* Supabase Connection */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Supabase Connection</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Connect your own Supabase project for heavy workloads — store agent data, knowledge bases, and run history in your own database.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Supabase URL</Label>
              <Input
                value={form.supabaseUrl}
                onChange={(e) => setForm((f) => ({ ...f, supabaseUrl: e.target.value }))}
                placeholder="https://yourproject.supabase.co"
                className="h-9 text-sm"
              />
            </div>
            <KeyField
              label="Supabase Anon Key"
              value={form.supabaseAnonKey}
              masked={user.supabaseAnonKey ? `Stored: ${user.supabaseAnonKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, supabaseAnonKey: v }))}
            />
          </div>
        </Card>

        {/* Save button */}
        <div className="flex gap-2">
          <Button onClick={saveKeys} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
          <Button variant="outline" onClick={() => setView("dashboard")}>Back to Dashboard</Button>
          <Button variant="ghost" onClick={handleSignOut} className="ml-auto gap-1.5 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

function KeyField({ label, value, masked, onChange }: { label: string; value: string; masked: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={masked || "Enter key…"}
        className="h-9 text-sm font-mono"
      />
      {masked && <p className="flex items-center gap-1 text-[11px] text-emerald-500"><Check className="h-3 w-3" /> {masked}</p>}
    </div>
  );
}
