import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals?uid=<firebaseUid>&status=pending|all
 *
 * Lists approvals across all agents owned by the user. Defaults to pending
 * only (the inbox view); pass `status=all` to include history.
 *
 * Each row is enriched with the parent agent's name and the matching node's
 * label + approval message so the UI can render a useful card without a
 * second round-trip.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const firebaseUid = searchParams.get("uid");
  const statusFilter = (searchParams.get("status") ?? "pending").toLowerCase();

  if (!firebaseUid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Pull all agents owned by the user so we can scope the approval rows.
  const agents = await db.agent.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, nodes: true },
  });
  if (agents.length === 0) {
    return NextResponse.json([]);
  }
  const agentIds = agents.map((a) => a.id);
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));
  const agentNodesById = new Map(agents.map((a) => [a.id, a.nodes]));

  const where =
    statusFilter === "all"
      ? { agentId: { in: agentIds } }
      : { agentId: { in: agentIds }, status: statusFilter };

  const rows = await db.approval.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Decorate each row with the agent name + node label + approval message.
  const enriched = rows.map((r) => {
    let nodeLabel = "";
    let approvalMessage = "";
    const nodesJson = agentNodesById.get(r.agentId);
    if (nodesJson) {
      try {
        const parsed = JSON.parse(nodesJson) as Array<{
          id: string;
          data?: { label?: string; approvalMessage?: string };
        }>;
        const match = parsed.find((n) => n.id === r.nodeId);
        if (match?.data) {
          nodeLabel = match.data.label ?? "";
          approvalMessage = match.data.approvalMessage ?? "";
        }
      } catch {
        // ignore malformed node JSON
      }
    }
    return {
      id: r.id,
      agentId: r.agentId,
      agentName: agentNameById.get(r.agentId) ?? "Unknown agent",
      runId: r.runId,
      nodeId: r.nodeId,
      nodeLabel,
      approvalMessage,
      context: r.context,
      status: r.status,
      decidedById: r.decidedById,
      decidedAt: r.decidedAt instanceof Date ? r.decidedAt.toISOString() : r.decidedAt,
      comment: r.comment,
      expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : r.expiresAt,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  });

  return NextResponse.json(enriched);
}
