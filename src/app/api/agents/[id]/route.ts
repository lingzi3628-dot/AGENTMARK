import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.agent.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toAgent(row));
}

// Deep equality check on the graph. We compare the canonical JSON strings —
// since both sides come from JSON.stringify (deterministic for the same
// object shape), this catches structural changes without false-positives
// from cosmetic updates like renames or pin toggles.
function graphChanged(
  prevNodes: string,
  prevEdges: string,
  nextNodes: unknown,
  nextEdges: unknown,
): boolean {
  if (nextNodes == null && nextEdges == null) return false;
  try {
    if (nextNodes != null) {
      const nextStr = JSON.stringify(nextNodes);
      if (nextStr !== prevNodes) return true;
    }
    if (nextEdges != null) {
      const nextStr = JSON.stringify(nextEdges);
      if (nextStr !== prevEdges) return true;
    }
  } catch {
    return true;
  }
  return false;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const existing = await db.agent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasGraph = body.nodes != null || body.edges != null;
  const graphMutated = hasGraph && graphChanged(
    existing.nodes,
    existing.edges,
    body.nodes,
    body.edges,
  );

  const updated = await db.agent.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      icon: body.icon ?? existing.icon,
      category: body.category ?? existing.category,
      pinned: body.pinned ?? existing.pinned,
      nodes: body.nodes ? JSON.stringify(body.nodes) : existing.nodes,
      edges: body.edges ? JSON.stringify(body.edges) : existing.edges,
    },
  });

  // Only snapshot a new AgentVersion when the graph actually changed.
  // Renames, pin/unpin, icon/category changes don't create history entries
  // (they're cosmetic and would pollute the timeline).
  if (graphMutated) {
    try {
      const latestMain = await db.agentVersion.findFirst({
        where: { agentId: id, branch: "main" },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latestMain?.version ?? 0) + 1;
      const message = (body.message as string | undefined)?.trim() || "Updated graph";
      await db.agentVersion.create({
        data: {
          agentId: id,
          version: nextVersion,
          branch: "main",
          message,
          name: updated.name,
          description: updated.description,
          nodes: updated.nodes,
          edges: updated.edges,
        },
      });
      await db.agent.update({
        where: { id },
        data: { currentVersion: nextVersion },
      });
    } catch {
      // Non-fatal — the agent update itself succeeded.
    }
  }

  return NextResponse.json(toAgent(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.agent.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
