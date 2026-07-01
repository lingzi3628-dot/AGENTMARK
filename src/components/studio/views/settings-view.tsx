"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  KeyRound, Database, BarChart3, Crown, LogOut, Loader2, Check, Save,
  Cpu, Zap, AlertTriangle, Trash2, Plus, Shield, Eye, EyeOff, Plug, DollarSign,
  CreditCard, ExternalLink, Store, BarChart2,
} from "lucide-react";
import { isAnalyticsEnabled, setAnalyticsEnabled, getInstanceId } from "@/lib/analytics";
import { signOut } from "@/lib/firebase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatTokens } from "@/lib/tokens";
import { spendLimitForPlan } from "@/lib/pricing";
import type { CustomApi } from "@/lib/types";

const PROVIDER_OPTIONS = [
  // Cloud providers
  { value: "glm", label: "GLM (Zhipu)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "mistral", label: "Mistral" },
  { value: "cohere", label: "Cohere" },
  { value: "together", label: "Together AI" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "fireworks", label: "Fireworks AI" },
  { value: "perplexity", label: "Perplexity" },
  // Local model runners (OpenAI-compatible)
  { value: "ollama", label: "🦙 Ollama (Local)" },
  { value: "lmstudio", label: "🖥️ LM Studio (Local)" },
  { value: "jan", label: "🤖 Jan (Local)" },
  { value: "llamacpp", label: "🔧 llama.cpp (Local)" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
];

// Preset base URLs for local model providers — auto-fills the baseUrl field
const PROVIDER_PRESETS: Record<string, { baseUrl: string; defaultModel: string; note: string }> = {
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    note: "Install Ollama from ollama.com, then run: ollama pull llama3.2",
  },
  lmstudio: {
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "loaded-model",
    note: "Load a model in LM Studio, then enable the Local Server (port 1234)",
  },
  jan: {
    baseUrl: "http://localhost:1337/v1",
    defaultModel: "llama3.2",
    note: "Jan app → Settings → Local API Server → Enable",
  },
  llamacpp: {
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "model",
    note: "Run: ./server -m model.gguf --port 8080",
  },
};

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
  const [customApis, setCustomApis] = useState<CustomApi[]>([]);
  const [loadingApis, setLoadingApis] = useState(true);
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApi, setNewApi] = useState({
    label: "",
    provider: "glm",
    baseUrl: "",
    modelName: "",
    apiKey: "",
  });

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

  const loadApis = useCallback(async () => {
    if (!user) return;
    setLoadingApis(true);
    try {
      const res = await fetch(`/api/user/apis?uid=${user.firebaseUid}`);
      if (res.ok) setCustomApis((await res.json()) as CustomApi[]);
    } catch {
      // non-fatal
    } finally {
      setLoadingApis(false);
    }
  }, [user]);

  useEffect(() => {
    void loadApis();
  }, [loadApis]);

  if (!user) return null;

  const tokensUsed = user.tokensUsedToday;
  const tokenLimit = user.dailyTokenLimit;
  const tokenPct = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100));
  const agentLimit = user.maxAgents;
  const agentPct = Math.min(100, Math.round((agentCount / agentLimit) * 100));
  const atAgentLimit = agentCount >= agentLimit;
  // V2 spend tracking — daily USD spend cap (free=$1, pro=$10, team=$50).
  // Bar turns amber above 80%, red at 100%.
  const spendUsedCents = user.spendUsedTodayCents ?? 0;
  const spendLimitCents = spendLimitForPlan(user.plan);
  const spendPct = Math.min(
    100,
    Math.round((spendUsedCents / Math.max(1, spendLimitCents)) * 100),
  );
  const spendBarColor =
    spendPct >= 100 ? "bg-destructive" : spendPct >= 80 ? "bg-amber-500" : "bg-primary";

  async function saveKeys() {
    setSaving(true);
    try {
      const body: Record<string, string> = { firebaseUid: user!.firebaseUid };
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

  async function addCustomApi() {
    const isLocal = !!PROVIDER_PRESETS[newApi.provider];
    if (!newApi.label.trim() || !newApi.provider) {
      toast.error("Label and provider are required");
      return;
    }
    // Local providers don't need a real API key — just any placeholder
    if (!isLocal && !newApi.apiKey.trim()) {
      toast.error("API key is required for cloud providers");
      return;
    }
    try {
      const res = await fetch("/api/user/apis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newApi, firebaseUid: user!.firebaseUid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success("API key added");
      setNewApi({ label: "", provider: "glm", baseUrl: "", modelName: "", apiKey: "" });
      setShowAddApi(false);
      void loadApis();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add API key");
    }
  }

  async function toggleApiActive(api: CustomApi) {
    try {
      const res = await fetch(`/api/user/apis/${api.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !api.isActive, firebaseUid: user!.firebaseUid }),
      });
      if (!res.ok) throw new Error();
      toast.success(api.isActive ? "API key disabled" : "API key enabled");
      void loadApis();
    } catch {
      toast.error("Failed to toggle");
    }
  }

  async function deleteCustomApi(api: CustomApi) {
    try {
      const res = await fetch(`/api/user/apis/${api.id}?uid=${user!.firebaseUid}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("API key deleted");
      void loadApis();
    } catch {
      toast.error("Failed to delete");
    }
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
            </div>

            {/* V2 spend tracking — daily USD spend cap (free=$1, pro=$10, team=$50) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-primary" /> Daily spend</span>
                <span className="text-muted-foreground">
                  ${(spendUsedCents / 100).toFixed(2)} / ${(spendLimitCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", spendBarColor)}
                  style={{ width: `${spendPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {spendPct}% of daily spend limit used.
                {spendPct >= 100 && " Limit reached — upgrade your plan to keep running."}
                {spendPct >= 80 && spendPct < 100 && " Approaching the daily spend limit."}
              </p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-primary" /> Agents</span>
                <span className="text-muted-foreground">{agentCount} / {agentLimit}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", atAgentLimit ? "bg-destructive" : agentPct > 80 ? "bg-amber-500" : "bg-primary")}
                  style={{ width: `${agentPct}%` }}
                />
              </div>
              {atAgentLimit && (
                <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Agent limit reached ({agentCount}/{agentLimit})
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Free plans are limited to {agentLimit} agents. Delete an existing agent to create a new one, or upgrade to a paid plan for unlimited agents.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setView("dashboard")} className="h-7 text-xs">
                      Manage agents
                    </Button>
                  </div>
                </div>
              )}
              {!atAgentLimit && agentPct >= 80 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3 w-3" /> Approaching agent limit — {agentLimit - agentCount} slot{(agentLimit - agentCount) !== 1 ? "s" : ""} left.
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={deleteIdleAgents}>
              <Trash2 className="h-3.5 w-3.5" /> Clean up idle agents (7+ days)
            </Button>
          </div>
        </Card>

        {/* Custom API Keys — for ANY provider */}
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Custom API Keys</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowAddApi((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" /> Add Key
            </Button>
          </div>
          <p className="mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span>
              Add API keys for any provider — GLM, OpenAI, Anthropic, Mistral, Cohere, Together, Groq, OpenRouter, DeepSeek, or any OpenAI-compatible endpoint.
              Keys are encrypted at rest with AES-256-GCM and never sent to the client after storage.
            </span>
          </p>

          {showAddApi && (
            <div className="mb-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={newApi.label}
                    onChange={(e) => setNewApi((a) => ({ ...a, label: e.target.value }))}
                    placeholder="My GLM key"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <Select value={newApi.provider} onValueChange={(v) => {
                    const preset = PROVIDER_PRESETS[v];
                    if (preset) {
                      // Auto-fill base URL + model name for local providers
                      setNewApi((a) => ({ ...a, provider: v, baseUrl: preset.baseUrl, modelName: preset.defaultModel, apiKey: a.apiKey || "local" }));
                    } else {
                      setNewApi((a) => ({ ...a, provider: v }));
                    }
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glm" disabled className="text-muted-foreground">── Cloud Providers ──</SelectItem>
                      {PROVIDER_OPTIONS.filter((p) => !["ollama", "lmstudio", "jan", "llamacpp", "custom"].includes(p.value)).map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                      <SelectItem value="ollama" disabled className="text-muted-foreground">── Local Models (Free) ──</SelectItem>
                      {PROVIDER_OPTIONS.filter((p) => ["ollama", "lmstudio", "jan", "llamacpp", "custom"].includes(p.value)).map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newApi.provider && PROVIDER_PRESETS[newApi.provider] && (
                    <p className="flex items-start gap-1 text-[11px] text-blue-500">
                      <span>💡</span>
                      <span>{PROVIDER_PRESETS[newApi.provider].note}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Base URL <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={newApi.baseUrl}
                    onChange={(e) => setNewApi((a) => ({ ...a, baseUrl: e.target.value }))}
                    placeholder="https://api.example.com/v1"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model name <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={newApi.modelName}
                    onChange={(e) => setNewApi((a) => ({ ...a, modelName: e.target.value }))}
                    placeholder="glm-4.6, gpt-4o, llama3.2"
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>
              {/* For local providers, API key is not required — show a note */}
              {newApi.provider && PROVIDER_PRESETS[newApi.provider] && (
                <p className="text-[11px] text-emerald-500">
                  ✅ Local model — no API key required. Just enter any value (e.g. "local").
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  value={newApi.apiKey}
                  onChange={(e) => setNewApi((a) => ({ ...a, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddApi(false)}>Cancel</Button>
                <Button size="sm" onClick={addCustomApi} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Save Key
                </Button>
              </div>
            </div>
          )}

          {loadingApis ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : customApis.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No custom API keys added yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Add a key to use your own provider quota.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customApis.map((api) => (
                <div
                  key={api.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    api.isActive ? "border-border bg-card" : "border-border bg-muted/20 opacity-60",
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    api.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{api.label}</span>
                      <Badge variant="outline" className="capitalize text-[10px]">{api.provider}</Badge>
                      {!api.isActive && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <code className="font-mono">{api.maskedKey}</code>
                      {api.modelName && <span>• {api.modelName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => toggleApiActive(api)}
                      aria-label={api.isActive ? "Disable" : "Enable"}
                      title={api.isActive ? "Disable" : "Enable"}
                    >
                      {api.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCustomApi(api)}
                      aria-label="Delete API key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Built-in BYOK keys (legacy fields — kept for backward compat) */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Built-in Provider Keys</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Quick-add fields for the three built-in providers. For any other provider (or to set a custom base URL / model name), use the Custom API Keys section above.
          </p>
          <div className="space-y-3">
            <KeyField
              label="GLM API Key"
              value={form.glmApiKey}
              masked={user.hasGlmKey ? `Stored: ${user.glmApiKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, glmApiKey: v }))}
            />
            <KeyField
              label="OpenAI API Key"
              value={form.openaiApiKey}
              masked={user.hasOpenaiKey ? `Stored: ${user.openaiApiKey}` : ""}
              onChange={(v) => setForm((f) => ({ ...f, openaiApiKey: v }))}
            />
            <KeyField
              label="Anthropic API Key"
              value={form.anthropicApiKey}
              masked={user.hasAnthropicKey ? `Stored: ${user.anthropicApiKey}` : ""}
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

        {/* Analytics Consent — opt-in to anonymous usage analytics */}
        <AnalyticsConsentSection />

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


function AnalyticsConsentSection() {
  // Lazy init: read from localStorage on first client render (avoids set-state-in-effect)
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : isAnalyticsEnabled(),
  );
  const [instanceId, setInstanceId] = useState(() =>
    typeof window === "undefined" ? "" : getInstanceId(),
  );

  function toggle() {
    const newValue = !enabled;
    setEnabled(newValue);
    setAnalyticsEnabled(newValue);
    toast.success(newValue ? "Analytics enabled — thank you!" : "Analytics disabled");
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Anonymous Analytics</h3>
        {enabled && (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]">
            Enabled
          </Badge>
        )}
      </div>

      <p className="mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Help improve AGENTMARK by sending <strong>anonymous</strong> usage data
          (app starts, agent count, feature usage). No API keys, no agent content,
          no personal info — just an anonymous instance ID. <strong>Opt-in only.</strong>
        </span>
      </p>

      <div className="space-y-3">
        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Instance ID</span>
            <code className="font-mono text-[10px]">{instanceId || "—"}</code>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Data sent</span>
            <span>App starts, agent count, run count, feature usage</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Not sent</span>
            <span>API keys, agent content, personal info, emails</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Send anonymous analytics</p>
            <p className="text-xs text-muted-foreground">
              Data is sent to Spyro Technology for product improvement.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </div>
    </Card>
  );
}
