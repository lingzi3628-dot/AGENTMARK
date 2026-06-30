import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

interface VersionRow {
  id: string;
  agentId: string;
  version: number;
  nodes: string;
  edges: string;
  name: string;
  description: string;
  branch: string;
  message: string;
  createdById: string | null;
  createdAt: Date | string;
}

function serializeFull(v: VersionRow) {
  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];
  try {
    nodes = JSON.parse(v.nodes) as WorkflowNode[];
    edges = JSON.parse(v.edges) as WorkflowEdge[];
  } catch {
    // corrupted version row — return empty graph
  }
  return {
    id: v.id,
    agentId: v.agentId,
    version: v.version,
    branch: v.branch,
    message: v.message,
    name: v.name,
    description: v.description,
    createdById: v.createdById,
    createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
    nodes,
    edges,
  };
}

// GET /api/agents/[id]/versions/[versionId]
// Returns a specific version with its full nodes/edges.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const row = await db.agentVersion.findUnique({ where: { id: versionId } });
  if (!row || row.agentId !== id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }
  return NextResponse.json(serializeFull(row));
}

// DELETE /api/agents/[id]/versions/[versionId]
// Only allowed for non-main branch versions — main-branch history is
// immutable so users can always restore from a known-good state.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const row = await db.agentVersion.findUnique({ where: { id: versionId } });
  if (!row || row.agentId !== id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }
  if (row.branch === "main") {
    return NextResponse.json(
      { error: "Cannot delete main-branch versions. History on main is immutable." },
      { status: 400 },
    );
  }
  await db.agentVersion.delete({ where: { id: versionId } });
  return NextResponse.json({ ok: true });
}
