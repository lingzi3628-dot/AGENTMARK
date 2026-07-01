import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminGuard } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/agents?key=<ADMIN_SECRET_KEY>
// List all agents across all users (platform overview).
export async function GET(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const agents = await db.agent.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      category: true,
      nodes: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true, name: true } },
      _count: { select: { runs: true, integrations: true } },
    },
  });

  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      nodeCount: JSON.parse(a.nodes || "[]").length,
      runCount: a._count.runs,
      integrationCount: a._count.integrations,
      userEmail: a.user?.email || "unknown",
      userName: a.user?.name || "unknown",
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    total: agents.length,
  });
}

// DELETE /api/admin/agents?id=<agentId>&key=<ADMIN_SECRET_KEY>
export async function DELETE(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const agentId = req.nextUrl.searchParams.get("id");
  if (!agentId) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.agent.delete({ where: { id: agentId } });

  return NextResponse.json({ ok: true });
}
