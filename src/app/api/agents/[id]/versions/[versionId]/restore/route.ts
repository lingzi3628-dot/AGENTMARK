import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/agents/[id]/versions/[versionId]/restore
// Copies the version's nodes/edges back onto the Agent AND creates a new
// main-branch version with a "Restored from vN" message — so restore is
// itself a versioned action and shows up in the timeline.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const source = await db.agentVersion.findUnique({ where: { id: versionId } });
  if (!source || source.agentId !== id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Find the next main-branch version number.
  const latestMain = await db.agentVersion.findFirst({
    where: { agentId: id, branch: "main" },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestMain?.version ?? 0) + 1;
  const message = `Restored from v${source.version} (${source.branch})`;

  // Create the new main-branch version with the source's graph.
  const restored = await db.agentVersion.create({
    data: {
      agentId: id,
      version: nextVersion,
      branch: "main",
      message,
      name: source.name,
      description: source.description,
      nodes: source.nodes,
      edges: source.edges,
    },
  });

  // Mirror onto the live agent.
  await db.agent.update({
    where: { id },
    data: {
      nodes: source.nodes,
      edges: source.edges,
      currentVersion: nextVersion,
      ...(source.name ? { name: source.name } : {}),
      ...(source.description ? { description: source.description } : {}),
    },
  });

  return NextResponse.json(
    {
      id: restored.id,
      version: restored.version,
      branch: restored.branch,
      message: restored.message,
      createdAt: restored.createdAt instanceof Date ? restored.createdAt.toISOString() : restored.createdAt,
    },
    { status: 201 },
  );
}
