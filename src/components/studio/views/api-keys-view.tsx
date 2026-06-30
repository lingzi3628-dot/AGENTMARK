"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  ShieldAlert,
  Code2,
  Terminal,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface ApiKeyListItem {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreatedKey {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  key: string;
  createdAt: string;
}

const SCOPE_OPTIONS = [
  { id: "agents:read", label: "agents:read", desc: "List & view agents" },
  { id: "agents:run", label: "agents:run", desc: "Execute agents" },
  { id: "agents:write", label: "agents:write", desc: "Create / update / delete" },
  { id: "templates:read", label: "templates:read", desc: "List marketplace templates" },
];

const SDK_SOURCE = `// AGENTMARK JavaScript SDK — copy into your project (browser, Node 18+, Bun, Deno)
export class AgentMark {
  constructor(apiKey, baseUrl = "https://your-app.vercel.app") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  async request(path, init = {}) {
    const res = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.apiKey,
        ...(init.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
    return data;
  }
  listAgents()                        { return this.request("/api/v1/agents"); }
  getAgent(id)                        { return this.request("/api/v1/agents/" + id); }
  createAgent(data)                   { return this.request("/api/v1/agents", { method: "POST",   body: JSON.stringify(data) }); }
  updateAgent(id, data)               { return this.request("/api/v1/agents/" + id, { method: "PATCH",  body: JSON.stringify(data) }); }
  deleteAgent(id)                     { return this.request("/api/v1/agents/" + id, { method: "DELETE" }); }
  runAgent(id, input, history)        { return this.request("/api/v1/agents/" + id + "/run", { method: "POST", body: JSON.stringify({ input, history }) }); }
  listTemplates()                     { return this.request("/api/v1/templates"); }
}

// Usage:
//   const am = new AgentMark("am_live_xxxxxxxx");
//   const agents = await am.listAgents();
//   const out = await am.runAgent(agents[0].id, "Hello!");
`;

const CURL_EXAMPLE = `# List your agents
curl https://your-app.vercel.app/api/v1/agents \\
  -H "Authorization: Bearer am_live_xxxxxxxx"

# Run an agent
curl -X POST https://your-app.vercel.app/api/v1/agents/<agent-id>/run \\
  -H "Authorization: Bearer am_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"input":"Hello, what can you do?"}'`;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ApiKeysView() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["agents:read", "agents:run"]);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/keys?firebaseUid=${user.firebaseUid}`, { cache: "no-store" });
      if (res.ok) setKeys((await res.json()) as ApiKeyListItem[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  function toggleScope(scope: string) {
    setNewScopes((cur) => (cur.includes(scope) ? cur.filter((s) => s !== scope) : [...cur, scope]));
  }

  async function handleCreate() {
    if (!user) return;
    if (!newLabel.trim()) {
      toast.error("Please give your key a label");
      return;
    }
    if (newScopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), scopes: newScopes, firebaseUid: user.firebaseUid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to create key");
      }
      setCreatedKey(data as CreatedKey);
      setCreateOpen(false);
      setNewLabel("");
      setNewScopes(["agents:read", "agents:run"]);
      await loadKeys();
      toast.success("API key created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(key: ApiKeyListItem, next: boolean) {
    if (!user) return;
    // Optimistic update
    setKeys((cur) => cur.map((k) => (k.id === key.id ? { ...k, isActive: next } : k)));
    try {
      const res = await fetch(`/api/v1/keys/${key.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.firebaseUid, isActive: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setKeys((cur) => cur.map((k) => (k.id === key.id ? { ...k, isActive: key.isActive } : k)));
      toast.error("Could not update key");
    }
  }

  async function handleRevoke(key: ApiKeyListItem) {
    if (!user) return;
    if (!confirm(`Revoke "${key.label}"? Any integration using this key will stop working immediately.`)) {
      return;
    }
    const prev = keys;
    setKeys((cur) => cur.filter((k) => k.id !== key.id));
    try {
      const res = await fetch(`/api/v1/keys/${key.id}?firebaseUid=${user.firebaseUid}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Key revoked");
    } catch {
      setKeys(prev);
      toast.error("Could not revoke key");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="h-5 w-5 text-primary" />
              API Keys
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate scoped API keys to build on AGENTMARK programmatically.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Key
          </Button>
        </div>

        {/* Keys list */}
        <Card className="p-0">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Your keys</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Keys are SHA-256 hashed at rest — the plaintext is shown only once at creation.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <KeyRound className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No API keys yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Create your first key to start using the AGENTMARK REST API or JS SDK.
              </p>
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New key
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{k.label}</span>
                      {k.isActive ? (
                        <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-muted bg-muted text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                        {k.prefix}…
                      </code>
                      <span className="text-[11px] text-muted-foreground">
                        {k.lastUsedAt
                          ? `used ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })}`
                          : "never used"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={k.isActive}
                        onCheckedChange={(v) => handleToggleActive(k, v)}
                        aria-label={`Toggle active for ${k.label}`}
                      />
                      <span className="text-xs text-muted-foreground">{k.isActive ? "On" : "Off"}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRevoke(k)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Developer documentation */}
        <DeveloperDocs baseUrlHint={typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"} />
      </div>

      {/* Create Key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Pick a memorable label and the scopes this key is allowed to use. You can change scopes later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="am-key-label">Label</Label>
              <Input
                id="am-key-label"
                placeholder="e.g. Production server, Zapier integration"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid gap-2">
                {SCOPE_OPTIONS.map((s) => {
                  const active = newScopes.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleScope(s.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                        )}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs">{s.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newLabel.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time reveal dialog */}
      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Save your API key
            </DialogTitle>
            <DialogDescription>
              This is the only time the full key will be shown. Copy it somewhere safe — you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          {createdKey && (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="mb-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {createdKey.label}
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs">
                    {createdKey.key}
                  </code>
                  <CopyButton text={createdKey.key} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {createdKey.scopes.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                If you lose this key, revoke it from the list above and create a new one.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Copy button + Developer docs sub-components
// ----------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CodeBlock({
  code,
  language,
  icon,
}: {
  code: string;
  language: string;
  icon: "terminal" | "code";
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-zinc-950/80">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon === "terminal" ? <Terminal className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
          <span>{language}</span>
        </div>
        <CopyButton text={code} className="h-7 px-2 text-[11px]" />
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-[12px] leading-relaxed text-zinc-100 studio-scroll">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DeveloperDocs({ baseUrlHint }: { baseUrlHint: string }) {
  const curl = useMemo(() => CURL_EXAMPLE.replace(/https:\/\/your-app\.vercel\.app/g, baseUrlHint), [baseUrlHint]);
  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Developer documentation</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Use the REST API directly or copy the JS SDK into your project.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> curl
          </div>
          <CodeBlock code={curl} language="bash" icon="terminal" />
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Code2 className="h-3.5 w-3.5" /> JavaScript SDK
          </div>
          <CodeBlock code={SDK_SOURCE} language="javascript" icon="code" />
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Base URL:</span>{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">{baseUrlHint}</code>
          <br />
          All endpoints require an{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">Authorization: Bearer am_live_…</code> header.
        </div>
      </div>
    </Card>
  );
}
