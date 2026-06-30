import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface BranchInfo {
  branch: string;
  latestVersion: number;
  latestVersionId: string;
  latestMessage: string;
  latestCreatedAt: string;
  versionCount: number;
}

// GET /api/agents/[id]/branches
// Lists all distinct branches on an agent with their latest version + count.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.agentVersion.findMany({
    where: { agentId: id },
    orderBy: [{ branch: "asc" }, { version: "desc" }],
  });

  const byBranch = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byBranch.get(r.branch) ?? [];
    arr.push(r);
    byBranch.set(r.branch, arr);
  }

  const branches: BranchInfo[] = [];
  for (const [branch, list] of byBranch.entries()) {
    const latest = list[0];
    branches.push({
      branch,
      latestVersion: latest.version,
      latestVersionId: latest.id,
      latestMessage: latest.message,
      latestCreatedAt:
        latest.createdAt instanceof Date ? latest.createdAt.toISOString() : latest.createdAt,
      versionCount: list.length,
    });
  }

  // main always sorts first; others alphabetical.
  branches.sort((a, b) => {
    if (a.branch === "main") return -1;
    if (b.branch === "main") return 1;
    return a.branch.localeCompare(b.branch);
  });

  return NextResponse.json(branches);
}

// POST /api/agents/[id]/branches
// Body: { fromVersionId, branchName }
// Creates a new branch starting from an existing version. The new branch's
// first version has the same nodes/edges as the source version, but a new
// version number on the new branch (typically 1).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fromVersionId = (body.fromVersionId as string)?.trim();
  const branchName = (body.branchName as string)?.trim();

  if (!fromVersionId) {
    return NextResponse.json({ error: "fromVersionId is required" }, { status: 400 });
  }
  if (!branchName || !/^[a-z0-9-]+$/i.test(branchName)) {
    return NextResponse.json(
      { error: "branchName must be alphanumeric with dashes (e.g. experiment-1)" },
      { status: 400 },
    );
  }
  if (branchName === "main") {
    return NextResponse.json({ error: "Cannot create a branch named 'main'" }, { status: 400 });
  }

  const source = await db.agentVersion.findUnique({ where: { id: fromVersionId } });
  if (!source || source.agentId !== id) {
    return NextResponse.json({ error: "Source version not found" }, { status: 404 });
  }

  // If the branch already exists, refuse — branching must be from a clean state.
  const existing = await db.agentVersion.findFirst({
    where: { agentId: id, branch: branchName },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Branch '${branchName}' already exists on this agent` },
      { status: 409 },
    );
  }

  const created = await db.agentVersion.create({
    data: {
      agentId: id,
      version: 1,
      branch: branchName,
      message: `Branched from v${source.version} (${source.branch})`,
      name: source.name,
      description: source.description,
      nodes: source.nodes,
      edges: source.edges,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      version: created.version,
      branch: created.branch,
      message: created.message,
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : created.createdAt,
    },
    { status: 201 },
  );
}
