import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/[id]/decide
 *
 * Records an approve / reject decision on an approval row. Only the agent's
 * owner may decide. Once committed, the polling executor in src/lib/ai.ts
 * notices the status change on its next tick and resumes / halts the run.
 *
 * Body: { decision: "approve" | "reject", comment?: string, firebaseUid: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    decision?: string;
    comment?: string;
    firebaseUid?: string;
  };

  const firebaseUid = body.firebaseUid;
  const decisionRaw = (body.decision ?? "").toLowerCase();
  const comment = (body.comment ?? "").trim().slice(0, 2000);

  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }
  if (decisionRaw !== "approve" && decisionRaw !== "reject") {
    return NextResponse.json(
      { error: "decision must be 'approve' or 'reject'" },
      { status: 400 },
    );
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

  // Guard: only the agent's owner can decide.
  const agent = await db.agent.findUnique({
    where: { id: row.agentId },
    select: { userId: true },
  });
  if (!agent || agent.userId !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Reject decisions on already-decided rows so we don't overwrite history.
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: `Approval already ${row.status}`, status: row.status },
      { status: 409 },
    );
  }

  const newStatus = decisionRaw === "approve" ? "approved" : "rejected";
  const updated = await db.approval.update({
    where: { id },
    data: {
      status: newStatus,
      decidedById: user.id,
      decidedAt: new Date(),
      comment,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    decidedById: updated.decidedById,
    decidedAt: updated.decidedAt instanceof Date ? updated.decidedAt.toISOString() : updated.decidedAt,
    comment: updated.comment,
  });
}
