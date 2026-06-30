import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/agents/[id]/documents/[docId]
// Removes a single document + its embedded chunks from the agent's store.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  // Verify the document belongs to this agent (defensive — docId is a cuid
  // but we want to avoid cross-agent deletes if a stale URL is hit).
  const doc = await db.document.findUnique({
    where: { id: docId },
    select: { agentId: true },
  });
  if (!doc || doc.agentId !== id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  await db.document.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}
