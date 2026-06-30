import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/[id]?uid=<firebaseUid>
 *
 * Fetches a single approval row (with the same agent + node enrichment as
 * the list endpoint). Used by the approvals view when a user opens a
 * specific pending card.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const firebaseUid = searchParams.get("uid");

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

  const row = await db.approval.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  // Guard: only the agent's owner can read this row.
  const agent = await db.agent.findUnique({
    where: { id: row.agentId },
    select: { userId: true, name: true, nodes: true },
  });
  if (!agent || agent.userId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let nodeLabel = "";
  let approvalMessage = "";
  if (agent.nodes) {
    try {
      const parsed = JSON.parse(agent.nodes) as Array<{
        id: string;
        data?: { label?: string; approvalMessage?: string };
      }>;
      const match = parsed.find((n) => n.id === row.nodeId);
      if (match?.data) {
        nodeLabel = match.data.label ?? "";
        approvalMessage = match.data.approvalMessage ?? "";
      }
    } catch {
      // ignore malformed node JSON
    }
  }

  return NextResponse.json({
    id: row.id,
    agentId: row.agentId,
    agentName: agent.name,
    runId: row.runId,
    nodeId: row.nodeId,
    nodeLabel,
    approvalMessage,
    context: row.context,
    status: row.status,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt instanceof Date ? row.decidedAt.toISOString() : row.decidedAt,
    comment: row.comment,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  });
}
