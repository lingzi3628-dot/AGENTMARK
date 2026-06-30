"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  Check,
  X,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";
import type { Agent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---- Types ------------------------------------------------------------------

interface ApprovalRow {
  id: string;
  agentId: string;
  agentName: string;
  runId: string;
  nodeId: string;
  nodeLabel: string;
  approvalMessage: string;
  context: string;
  status: "pending" | "approved" | "rejected" | "expired";
  decidedById: string | null;
  decidedAt: string | null;
  comment: string;
  expiresAt: string | null;
  createdAt: string;
}

type Decision = "approve" | "reject";

// ---- Component --------------------------------------------------------------

export function ApprovalsView() {
  const { user } = useAuth();
  const { setActiveAgent, setView } = useStudio();
  const [pending, setPending] = useState<ApprovalRow[]>([]);
  const [history, setHistory] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogApproval, setDialogApproval] = useState<ApprovalRow | null>(null);
  const [dialogDecision, setDialogDecision] = useState<Decision>("approve");
  const [dialogComment, setDialogComment] = useState("");

  const fetchAll = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [pendRes, allRes] = await Promise.all([
        fetch(`/api/approvals?uid=${encodeURIComponent(user.uid)}&status=pending`),
        fetch(`/api/approvals?uid=${encodeURIComponent(user.uid)}&status=all`),
      ]);
      if (pendRes.ok) {
        const rows = (await pendRes.json()) as ApprovalRow[];
        setPending(rows);
      }
      if (allRes.ok) {
        const rows = (await allRes.json()) as ApprovalRow[];
        // History = everything that's no longer pending.
        setHistory(rows.filter((r) => r.status !== "pending"));
      }
    } catch {
      // non-fatal — keep the existing list
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchAll();
    // Poll every 15 seconds so pending approvals refresh automatically while
    // the user keeps the tab open. The endpoint is cheap (200-row cap + index
    // on agentId+status).
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  function openDialog(row: ApprovalRow, decision: Decision) {
    setDialogApproval(row);
    setDialogDecision(decision);
    setDialogComment("");
    setDialogOpen(true);
  }

  async function submitDecision() {
    if (!user?.uid || !dialogApproval) return;
    setDecidingId(dialogApproval.id);
    try {
      const res = await fetch(
        `/api/approvals/${encodeURIComponent(dialogApproval.id)}/decide`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision: dialogDecision,
            comment: dialogComment,
            firebaseUid: user.uid,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to record decision");
        return;
      }
      toast.success(
        dialogDecision === "approve"
          ? "Approved — workflow will resume"
          : "Rejected — workflow stopped",
      );
      setDialogOpen(false);
      await fetchAll();
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            Human-in-the-loop Approvals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review workflow steps that paused for your sign-off. Pending approvals refresh every 15 seconds.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pending
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="pending" className="mt-4">
          {loading ? (
            <PendingSkeleton />
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7 text-emerald-500" />}
              title="No pending approvals"
              desc="When a workflow hits an approval node, it shows up here for you to review."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pending.map((row) => (
                <PendingCard
                  key={row.id}
                  row={row}
                  deciding={decidingId === row.id}
                  onApprove={() => openDialog(row, "approve")}
                  onReject={() => openDialog(row, "reject")}
                  onOpenAgent={() => {
                    // Switch to the studio so the user can see the node in context.
                    useStudio.getState().setActiveAgentById?.(row.agentId);
                    setActiveAgentByIdFallback(row.agentId, setActiveAgent, setView);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4">
          {loading ? (
            <PendingSkeleton />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-7 w-7 text-muted-foreground" />}
              title="No decisions yet"
              desc="Approved or rejected requests will show up here once you start using approval nodes."
            />
          ) : (
            <div className="space-y-3">
              {history.map((row) => (
                <HistoryRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Decision dialog (with comment) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogDecision === "approve" ? (
                <Check className="h-5 w-5 text-emerald-500" />
              ) : (
                <X className="h-5 w-5 text-rose-500" />
              )}
              {dialogDecision === "approve" ? "Approve this step" : "Reject this step"}
            </DialogTitle>
            <DialogDescription>
              {dialogApproval?.agentName} • {dialogApproval?.nodeLabel || "Approval node"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-medium text-muted-foreground">Approval message</div>
              <div className="text-sm">{dialogApproval?.approvalMessage || "—"}</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comment" className="text-xs">Comment (optional)</Label>
              <Textarea
                id="comment"
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                placeholder={
                  dialogDecision === "approve"
                    ? "Approved — proceed."
                    : "Reason for rejection..."
                }
                rows={3}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={submitDecision}
              disabled={!!decidingId}
              className={cn(
                "gap-1.5",
                dialogDecision === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-rose-600 text-white hover:bg-rose-500",
              )}
            >
              {decidingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dialogDecision === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// setActiveAgentById isn't on the store — wrap defensively. If absent, we
// fall back to switching the view to studio so the user can pick the agent
// manually from the sidebar.
function setActiveAgentByIdFallback(
  _agentId: string,
  _setActiveAgent: unknown,
  setView: (v: "studio") => void,
) {
  setView("studio");
}

// ---- Pending card -----------------------------------------------------------

function PendingCard({
  row,
  deciding,
  onApprove,
  onReject,
  onOpenAgent,
}: {
  row: ApprovalRow;
  deciding: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOpenAgent: () => void;
}) {
  const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
  const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  return (
    <Card className="flex flex-col border-amber-500/40 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">{row.nodeLabel || "Approval required"}</span>
            </CardTitle>
            <CardDescription className="mt-1 truncate">
              {row.agentName} • created {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
            Pending
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {row.approvalMessage && (
          <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            {row.approvalMessage}
          </div>
        )}
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Context
          </div>
          <pre className="max-h-40 overflow-y-auto studio-scroll whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {row.context || "(no upstream context)"}
          </pre>
        </div>
        {expiresAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {expired ? (
              <span className="text-rose-500">Expired — auto-rejecting</span>
            ) : (
              <span>
                Expires in {formatDistanceToNow(expiresAt, { addSuffix: true })}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAgent}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View agent
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={deciding}
            className="gap-1.5 border-rose-500/40 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
          >
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={deciding}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {deciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// ---- History row ------------------------------------------------------------

function HistoryRow({ row }: { row: ApprovalRow }) {
  const tone =
    row.status === "approved"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : row.status === "rejected"
        ? "border-rose-500/30 bg-rose-500/5"
        : "border-amber-500/30 bg-amber-500/5";
  const badge =
    row.status === "approved"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
      : row.status === "rejected"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
        : "border-amber-500/40 bg-amber-500/10 text-amber-500";
  const decidedAt = row.decidedAt ? new Date(row.decidedAt) : null;

  return (
    <Card className={cn("border", tone)}>
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {row.nodeLabel || "Approval node"}
            </span>
            <Badge variant="outline" className={cn("capitalize", badge)}>
              {row.status}
            </Badge>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.agentName}
            {decidedAt && (
              <> • decided {formatDistanceToNow(decidedAt, { addSuffix: true })}</>
            )}
          </div>
          {row.comment && (
            <div className="mt-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              "{row.comment}"
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Loading + empty helpers ----------------------------------------------

function PendingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="border-amber-500/20">
          <CardHeader>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted/60" />
          </CardHeader>
          <CardContent>
            <div className="h-24 animate-pulse rounded bg-muted/40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          {icon}
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
