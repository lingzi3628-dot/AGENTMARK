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

function serialize(v: VersionRow) {
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
  };
}

// GET /api/agents/[id]/versions?branch=main
// Lists versions for an agent, optionally filtered by branch. Sorted by
// version DESC (newest first).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch");
  const rows = await db.agentVersion.findMany({
    where: {
      agentId: id,
      ...(branch ? { branch } : {}),
    },
    orderBy: [{ branch: "asc" }, { version: "desc" }],
    take: 200,
  });
  return NextResponse.json(rows.map(serialize));
}

// POST /api/agents/[id]/versions
// Body: { nodes, edges, name, description, branch?, message? }
// Saves a new version on the given branch (default "main"), auto-incrementing
// the version number. Also updates the parent Agent's nodes/edges/currentVersion
// to match — the Agent's "current" state is always the latest main-branch
// version.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({ where: { id }, select: { id: true } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const nodes: WorkflowNode[] = Array.isArray(body.nodes) ? body.nodes : [];
  const edges: WorkflowEdge[] = Array.isArray(body.edges) ? body.edges : [];
  const name = (body.name as string)?.trim() || "";
  const description = (body.description as string)?.trim() || "";
  const branch = (body.branch as string)?.trim() || "main";
  const message = (body.message as string)?.trim() || "";

  // Find the highest version number on this branch and increment.
  const latest = await db.agentVersion.findFirst({
    where: { agentId: id, branch },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await db.agentVersion.create({
    data: {
      agentId: id,
      version: nextVersion,
      branch,
      message,
      name,
      description,
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
    },
  });

  // The Agent's "current" state mirrors the latest main-branch version.
  // Branch versions are kept isolated — they don't mutate the live agent
  // until restored (which itself creates a new main-branch version).
  if (branch === "main") {
    await db.agent.update({
      where: { id },
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        currentVersion: nextVersion,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      },
    });
  }

  return NextResponse.json(serialize(created), { status: 201 });
}
