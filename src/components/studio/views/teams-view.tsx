"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Users,
  Plus,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Loader2,
  Crown,
  Shield,
  Pencil,
  UserPlus,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  Workflow,
  ScrollText,
  Settings as SettingsIcon,
  MoreVertical,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { Agent } from "@/lib/types";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type Role = "owner" | "admin" | "editor" | "viewer";

interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  plan: string;
  ownerId: string;
  role: Role;
  memberCount: number;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TeamDetail extends TeamSummary {
  maxAgents: number;
}

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string | null;
  invitedAt: string;
  email: string;
  name: string;
  photoURL: string;
}

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string; email: string; photoURL: string } | null;
}

interface AuditPage {
  entries: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ROLE_OPTIONS: Role[] = ["admin", "editor", "viewer"];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function TeamsView() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams?firebaseUid=${user.firebaseUid}`, { cache: "no-store" });
      if (res.ok) setTeams((await res.json()) as TeamSummary[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Boot + auto-accept pending invite from `?joinTeam=...` URL parameter.
  useEffect(() => {
    if (!user) return;
    void loadTeams();
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const joinTeam = url.searchParams.get("joinTeam");
    if (!joinTeam) return;
    // Clean the URL first so a refresh doesn't re-trigger.
    url.searchParams.delete("joinTeam");
    url.searchParams.delete("slug");
    window.history.replaceState({}, "", url.toString());
    (async () => {
      try {
        const res = await fetch("/api/teams/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ firebaseUid: user.firebaseUid, teamId: joinTeam }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if ((data as { already?: boolean }).already) {
            toast.info("You're already a member of that team.");
          } else {
            toast.success("Invite accepted — welcome to the team!");
          }
          await loadTeams();
          setActiveTeamId(joinTeam);
        } else {
          toast.error((data as { error?: string }).error || "Could not accept invite");
        }
      } catch {
        toast.error("Could not accept invite");
      }
    })();
  }, [user, loadTeams]);

  async function handleCreate() {
    if (!user) return;
    if (!newName.trim()) {
      toast.error("Team name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user.firebaseUid,
          name: newName.trim(),
          description: newDescription.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create team");
      await loadTeams();
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      toast.success("Team created");
      setActiveTeamId((data as TeamSummary).id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  if (!user) return null;

  if (activeTeamId) {
    return (
      <TeamDetailPanel
        teamId={activeTeamId}
        onBack={() => {
          setActiveTeamId(null);
          void loadTeams();
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-primary" />
              Teams
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share agents with collaborators and audit team activity.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>

        {/* Teams grid */}
        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : teams.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">No teams yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Create a team to share agents with collaborators, assign roles, and audit activity.
            </p>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New team
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTeamId(t.id)}
                className="group rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.description || `/${t.slug}`}
                    </div>
                  </div>
                  <RoleBadge role={t.role} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {t.memberCount} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Workflow className="h-3 w-3" /> {t.agentCount} agents
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Team dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>
              You&apos;ll be the owner. Invite teammates by email after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="am-team-name">Team name</Label>
              <Input
                id="am-team-name"
                placeholder="e.g. Marketing, Customer Support"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="am-team-desc">Description (optional)</Label>
              <Input
                id="am-team-desc"
                placeholder="What is this team for?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Role badge
// ----------------------------------------------------------------------------

function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, { cls: string; icon: typeof Crown }> = {
    owner: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-500", icon: Crown },
    admin: { cls: "border-primary/30 bg-primary/10 text-primary", icon: Shield },
    editor: { cls: "border-sky-500/30 bg-sky-500/10 text-sky-500", icon: Pencil },
    viewer: { cls: "border-muted bg-muted text-muted-foreground", icon: Users },
  };
  const m = map[role];
  const IconCmp = m.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 px-2 py-0.5 text-[10px] capitalize", m.cls)}>
      <IconCmp className="h-3 w-3" />
      {role}
    </Badge>
  );
}

// ----------------------------------------------------------------------------
// Team detail panel
// ----------------------------------------------------------------------------

function TeamDetailPanel({ teamId, onBack }: { teamId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { setView } = useStudio();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}?firebaseUid=${user.firebaseUid}`, { cache: "no-store" });
      if (res.ok) setTeam((await res.json()) as TeamDetail);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;
  if (loading || !team) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading team…
      </div>
    );
  }

  const isOwner = team.role === "owner";

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to teams">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <RoleBadge role={team.role} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {team.description || `/${team.slug}`} · {team.memberCount} members · {team.agentCount} agents
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="agents" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agents" className="gap-1.5">
              <Workflow className="h-3.5 w-3.5" /> Agents
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Members
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Audit
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <SettingsIcon className="h-3.5 w-3.5" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-4">
            <AgentsTab teamId={teamId} canEdit={team.role !== "viewer"} onOpenAgent={(a) => {
              useStudio.getState().setActiveAgent(a);
              setView("studio");
            }} />
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <MembersTab teamId={teamId} role={team.role} currentUserId={user.id} onChanged={load} />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditTab teamId={teamId} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsTab team={team} isOwner={isOwner} onChanged={load} onDeleted={onBack} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Agents tab
// ----------------------------------------------------------------------------

function AgentsTab({
  teamId,
  canEdit,
  onOpenAgent,
}: {
  teamId: string;
  canEdit: boolean;
  onOpenAgent: (a: Agent) => void;
}) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/agents?firebaseUid=${user.firebaseUid}`, { cache: "no-store" });
      if (res.ok) setAgents((await res.json()) as Agent[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!user) return;
    const name = prompt("Agent name?");
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.firebaseUid, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create");
      await load();
      toast.success("Agent created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
    </div>;
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Team agents</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{agents.length} agents in this team</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New agent
          </Button>
        )}
      </div>
      {agents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
          <Workflow className="h-6 w-6 opacity-60" />
          <p className="text-xs">No agents yet. {canEdit && "Create one to get started."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {agents.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onOpenAgent(a)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name={a.icon} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.description || `${a.nodes.length} nodes · updated ${formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}`}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Members tab
// ----------------------------------------------------------------------------

function MembersTab({
  teamId,
  role,
  currentUserId,
  onChanged,
}: {
  teamId: string;
  role: Role;
  currentUserId: string;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members?firebaseUid=${user.firebaseUid}`, { cache: "no-store" });
      if (res.ok) setMembers((await res.json()) as Member[]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite() {
    if (!user) return;
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user.firebaseUid,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to invite");
      }
      const joinUrl = (data as { joinUrl?: string }).joinUrl;
      if (joinUrl) {
        setInviteLink(joinUrl);
      }
      await load();
      toast.success("Invite created — share the link below");
      setInviteEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(member: Member, newRole: Role) {
    if (!user) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firebaseUid: user.firebaseUid, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update role");
      await load();
      toast.success(`Role updated to ${newRole}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    }
  }

  async function handleRemove(member: Member) {
    if (!user) return;
    const isSelf = member.userId === currentUserId;
    if (!confirm(isSelf ? "Leave this team?" : `Remove ${member.name || member.email}?`)) return;
    try {
      const res = await fetch(
        `/api/teams/${teamId}/members/${member.id}?firebaseUid=${user.firebaseUid}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to remove");
      }
      await load();
      onChanged();
      toast.success(isSelf ? "Left team" : "Member removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
    </div>;
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Members</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{members.length} total</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          const isOwnerRow = m.role === "owner";
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-9 w-9">
                {m.photoURL ? <AvatarImage src={m.photoURL} alt={m.name} /> : null}
                <AvatarFallback>{(m.name || m.email)[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{m.name || m.email}</span>
                  {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.joinedAt
                    ? ` · joined ${formatDistanceToNow(new Date(m.joinedAt), { addSuffix: true })}`
                    : " · pending invite"}
                </div>
              </div>
              <RoleBadge role={m.role} />
              {canManage && !isOwnerRow ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                      Change role
                    </DropdownMenuItem>
                    {ROLE_OPTIONS.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => handleChangeRole(m, r)}
                        disabled={m.role === r}
                      >
                        Make {r}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleRemove(m)}
                    >
                      {isSelf ? "Leave team" : "Remove"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : isSelf && !isOwnerRow ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemove(m)}>
                  Leave
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setInviteLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They must already have an AGENTMARK account with that email. After inviting, share the link below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="am-invite-email">Email</Label>
              <Input
                id="am-invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {inviteRole === "admin" && "Full access: manage members, settings, agents."}
                {inviteRole === "editor" && "Can create + edit team agents."}
                {inviteRole === "viewer" && "Read-only access to team agents and audit log."}
              </p>
            </div>
            {inviteLink && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <LinkIcon className="h-3.5 w-3.5" /> Invite link
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                    {inviteLink}
                  </code>
                  <CopyButton text={inviteLink} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Send this to your teammate. They&apos;ll be added automatically when they open it.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Done</Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-1.5">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Audit tab
// ----------------------------------------------------------------------------

function AuditTab({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/teams/${teamId}/audit?firebaseUid=${user.firebaseUid}&page=${page}`,
          { cache: "no-store" },
        );
        if (!cancelled && res.ok) setData((await res.json()) as AuditPage);
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, teamId, page]);

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
    </div>;
  }
  if (!data || data.entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <ScrollText className="h-6 w-6 opacity-60" />
        <p className="text-xs">No activity yet. Actions taken in this team will appear here.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Audit log</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{data.total} events</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Resource</TableHead>
              <TableHead className="hidden lg:table-cell">IP</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <code className="font-mono text-[11px] text-foreground/90">{e.action}</code>
                </TableCell>
                <TableCell>
                  {e.actor ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {e.actor.photoURL ? <AvatarImage src={e.actor.photoURL} alt={e.actor.name} /> : null}
                        <AvatarFallback className="text-[10px]">
                          {(e.actor.name || e.actor.email)[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{e.actor.name || e.actor.email}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {e.resourceType ? `${e.resourceType}` : "—"}
                    {e.resourceId ? ` · ${e.resourceId.slice(-6)}` : ""}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">{e.ipAddress || "—"}</span>
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Settings tab
// ----------------------------------------------------------------------------

function SettingsTab({
  team,
  isOwner,
  onChanged,
  onDeleted,
}: {
  team: TeamDetail;
  isOwner: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync local form when the team prop changes (e.g. after onChanged refetch).
  useEffect(() => {
    setName(team.name);
    setDescription(team.description);
  }, [team.id, team.name, team.description]);

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firebaseUid: user.firebaseUid,
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to save");
      toast.success("Team updated");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    if (!confirm(`Delete "${team.name}"? This permanently removes all team agents and members. This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${team.id}?firebaseUid=${user.firebaseUid}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to delete");
      }
      toast.success("Team deleted");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Settings</h3>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="am-team-edit-name">Team name</Label>
          <Input
            id="am-team-edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner && team.role !== "admin"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="am-team-edit-desc">Description</Label>
          <Input
            id="am-team-edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isOwner && team.role !== "admin"}
          />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground">Plan</div>
            <div className="mt-0.5 font-medium capitalize">{team.plan}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Agent limit</div>
            <div className="mt-0.5 font-medium">{team.maxAgents}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="mt-0.5">{formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Slug</div>
            <div className="mt-0.5 font-mono">/{team.slug}</div>
          </div>
        </div>

        {(isOwner || team.role === "admin") && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        )}

        {isOwner && (
          <>
            <Separator />
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Delete this team</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Permanently removes the team, all its agents, members, and audit history.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="mt-3 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete team
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Copy button (local to this view)
// ----------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
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
    <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
