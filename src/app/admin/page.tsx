"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard, Users, KeyRound, Bot, BarChart3, Zap, DollarSign,
  Loader2, Trash2, Power, Search, ShieldAlert, Activity, Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Stats {
  totals: {
    users: number; agents: number; runs: number; apiKeys: number;
    templates: number; published: number; integrations: number;
    messages: number; schedules: number; documents: number; recentUsers7d: number;
  };
  today: { tokens: number; costCents: number; costUsd: string; runs: number };
  daily: { date: string; runs: number; tokens: number; costCents: number; errors: number }[];
}

interface User {
  id: string; email: string; name: string; photoURL: string; plan: string;
  maxAgents: number; dailyTokenLimit: number; tokensUsedToday: number;
  createdAt: string;
  _count: { agents: number; runs: number; apiKeys: number; customApis: number };
}

interface SdkKey {
  id: string; label: string; prefix: string; scopes: string;
  isActive: boolean; lastUsedAt: string | null; createdAt: string;
  userEmail: string; userName: string;
}

interface Agent {
  id: string; name: string; description: string; icon: string; category: string;
  nodeCount: number; runCount: number; integrationCount: number;
  userEmail: string; userName: string; createdAt: string; updatedAt: string;
}

type Tab = "dashboard" | "users" | "sdk-keys" | "agents";

export default function AdminPage() {
  // Lazy init: read admin key from URL on first client render (avoids set-state-in-effect)
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("key") || "";
  });
  const [authed, setAuthed] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!new URLSearchParams(window.location.search).get("key");
  });
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!authed) {
    return <LoginScreen adminKey={adminKey} setAdminKey={setAdminKey} onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">AGENTMARK Admin Panel</h1>
                <p className="text-xs text-muted-foreground">Spyro Technology · Private · Secured</p>
              </div>
            </div>
            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500">
              <ShieldAlert className="h-3 w-3 mr-1" /> ADMIN
            </Badge>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "users", label: "Users", icon: Users },
            { id: "sdk-keys", label: "SDK Keys", icon: KeyRound },
            { id: "agents", label: "Agents", icon: Bot },
          ] as { id: Tab; label: string; icon: typeof LayoutDashboard }[]).map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTab(t.id)}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        {tab === "dashboard" && <DashboardTab adminKey={adminKey} />}
        {tab === "users" && <UsersTab adminKey={adminKey} />}
        {tab === "sdk-keys" && <SdkKeysTab adminKey={adminKey} />}
        {tab === "agents" && <AgentsTab adminKey={adminKey} />}
      </div>
    </div>
  );
}

function LoginScreen({ adminKey, setAdminKey, onAuth }: {
  adminKey: string; setAdminKey: (v: string) => void; onAuth: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">Admin Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your admin secret key to access the control panel.
          </p>
        </div>
        <Input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin secret key…"
          className="h-11 font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") onAuth(); }}
          autoFocus
        />
        <Button onClick={onAuth} disabled={!adminKey} className="w-full h-11 gap-1.5">
          <ShieldAlert className="h-4 w-4" /> Access Admin Panel
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          This panel is not linked in the public UI. Only authorized personnel have access.
        </p>
      </Card>
    </div>
  );
}

function DashboardTab({ adminKey }: { adminKey: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?key=${adminKey}`);
      if (res.ok) setStats(await res.json());
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !stats) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const cards = [
    { label: "Users", value: stats.totals.users, icon: Users, color: "text-blue-500" },
    { label: "Agents", value: stats.totals.agents, icon: Bot, color: "text-emerald-500" },
    { label: "Runs", value: stats.totals.runs, icon: Activity, color: "text-purple-500" },
    { label: "API Keys", value: stats.totals.apiKeys, icon: KeyRound, color: "text-amber-500" },
    { label: "Templates", value: stats.totals.templates, icon: LayoutDashboard, color: "text-cyan-500" },
    { label: "Published", value: stats.totals.published, icon: Cpu, color: "text-pink-500" },
    { label: "Integrations", value: stats.totals.integrations, icon: Zap, color: "text-indigo-500" },
    { label: "Messages", value: stats.totals.messages, icon: BarChart3, color: "text-teal-500" },
    { label: "Schedules", value: stats.totals.schedules, icon: Activity, color: "text-orange-500" },
    { label: "Documents", value: stats.totals.documents, icon: Cpu, color: "text-red-500" },
  ];

  return (
    <div className="space-y-5">
      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5" /> Tokens today</div>
          <div className="mt-1 text-2xl font-bold">{stats.today.tokens.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /> Cost today</div>
          <div className="mt-1 text-2xl font-bold">${stats.today.costUsd}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Runs today</div>
          <div className="mt-1 text-2xl font-bold">{stats.today.runs}</div>
        </Card>
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <c.icon className={cn("h-3.5 w-3.5", c.color)} /> {c.label}
            </div>
            <div className="mt-1 text-xl font-semibold">{c.value}</div>
          </Card>
        ))}
      </div>

      {/* New users badge */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium">New registrations (last 7 days):</span>
          <Badge className="bg-blue-500/15 text-blue-500">{stats.totals.recentUsers7d}</Badge>
        </div>
      </Card>

      {/* Daily chart */}
      {stats.daily.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Daily runs (last 30 days)</h3>
          <div className="flex items-end gap-1 h-32">
            {stats.daily.map((d) => {
              const maxRuns = Math.max(...stats.daily.map((x) => x.runs), 1);
              return (
                <div
                  key={d.date}
                  className="flex-1 rounded-t bg-primary/60 hover:bg-primary transition-colors"
                  style={{ height: `${(d.runs / maxRuns) * 100}%`, minHeight: "2px" }}
                  title={`${d.date}: ${d.runs} runs, ${d.tokens} tokens`}
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function UsersTab({ adminKey }: { adminKey: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?key=${adminKey}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This removes ALL their data.`)) return;
    await fetch(`/api/admin/users?id=${id}&key=${adminKey}`, { method: "DELETE" });
    toast.success("User deleted");
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">All Users ({users.length})</h3>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-4 text-left">User</th>
              <th className="py-2 px-4 text-left">Plan</th>
              <th className="py-2 px-4 text-left">Agents</th>
              <th className="py-2 px-4 text-left">Runs</th>
              <th className="py-2 px-4 text-left">Keys</th>
              <th className="py-2 px-4 text-left">Joined</th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50">
                <td className="py-2 pr-4">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="py-2 px-4">
                  <Badge variant="outline" className="capitalize text-[10px]">{u.plan}</Badge>
                </td>
                <td className="py-2 px-4">{u._count.agents}</td>
                <td className="py-2 px-4">{u._count.runs}</td>
                <td className="py-2 px-4">{u._count.apiKeys}</td>
                <td className="py-2 px-4 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                </td>
                <td className="py-2 px-4">
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => deleteUser(u.id, u.email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SdkKeysTab({ adminKey }: { adminKey: string }) {
  const [keys, setKeys] = useState<SdkKey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sdk-keys?key=${adminKey}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  async function toggleKey(id: string, isActive: boolean) {
    await fetch(`/api/admin/sdk-keys?key=${adminKey}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    toast.success(isActive ? "Key disabled" : "Key enabled");
    void load();
  }

  async function deleteKey(id: string) {
    if (!confirm("Revoke this API key permanently?")) return;
    await fetch(`/api/admin/sdk-keys?id=${id}&key=${adminKey}`, { method: "DELETE" });
    toast.success("Key revoked");
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">SDK API Keys ({keys.length})</h3>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <KeyRound className={cn("h-4 w-4", k.isActive ? "text-emerald-500" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono">{k.prefix}…</code>
                <Badge variant="outline" className="text-[10px]">{k.label}</Badge>
                {k.isActive ? (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]">Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {k.userName} ({k.userEmail}) · Used {k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "never"}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleKey(k.id, k.isActive)}>
              <Power className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteKey(k.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AgentsTab({ adminKey }: { adminKey: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agents?key=${adminKey}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  async function deleteAgent(id: string, name: string) {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await fetch(`/api/admin/agents?id=${id}&key=${adminKey}`, { method: "DELETE" });
    toast.success("Agent deleted");
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">All Agents ({agents.length})</h3>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Bot className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{a.name}</span>
                <Badge variant="outline" className="text-[10px]">{a.nodeCount} nodes</Badge>
                <Badge variant="outline" className="text-[10px]">{a.runCount} runs</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {a.userName} ({a.userEmail}) · {a.category} · Updated {formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAgent(a.id, a.name)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
