import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminGuard } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/users?key=<ADMIN_SECRET_KEY>
// List all registered users.
export async function GET(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      photoURL: true,
      plan: true,
      maxAgents: true,
      dailyTokenLimit: true,
      tokensUsedToday: true,
      createdAt: true,
      _count: {
        select: {
          agents: true,
          runs: true,
          apiKeys: true,
          customApis: true,
        },
      },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    total: users.length,
  });
}

// DELETE /api/admin/users?id=<userId>&key=<ADMIN_SECRET_KEY>
// Delete a user + all their data.
export async function DELETE(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const userId = req.nextUrl.searchParams.get("id");
  if (!userId) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.user.delete({ where: { id: userId } }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/users?key=<ADMIN_SECRET_KEY>
// Update a user's plan/limits.
export async function PATCH(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const { id, plan, maxAgents, dailyTokenLimit } = body as {
    id: string;
    plan?: string;
    maxAgents?: number;
    dailyTokenLimit?: number;
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (plan !== undefined) data.plan = plan;
  if (maxAgents !== undefined) data.maxAgents = maxAgents;
  if (dailyTokenLimit !== undefined) data.dailyTokenLimit = dailyTokenLimit;

  const updated = await db.user.update({ where: { id }, data });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      plan: updated.plan,
      maxAgents: updated.maxAgents,
      dailyTokenLimit: updated.dailyTokenLimit,
    },
  });
}
