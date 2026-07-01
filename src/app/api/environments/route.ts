// Environment staging + promotion — deploy agents from dev → staging → prod.
// Each environment has its own set of agents + env vars.
// Promote = copy an agent (with its workflow) from one environment to another.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export type Environment = "dev" | "staging" | "production";

// GET /api/environments?uid=<firebaseUid> — list environments + their agents
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const agents = await db.agent.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      category: true,
      pinned: true,
      nodes: true,
      edges: true,
      updatedAt: true,
    },
  });

  const environments: Record<Environment, typeof agents> = {
    dev: [],
    staging: [],
    production: [],
  };

  for (const agent of agents) {
    const env: Environment = agent.category.startsWith("staging-")
      ? "staging"
      : agent.category.startsWith("production-")
        ? "production"
        : "dev";
    environments[env].push(agent);
  }

  return NextResponse.json({
    environments: {
      dev: { count: environments.dev.length, agents: environments.dev },
      staging: { count: environments.staging.length, agents: environments.staging },
      production: { count: environments.production.length, agents: environments.production },
    },
    total: agents.length,
  });
}

// POST /api/environments/promote — promote an agent to the next environment
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { agentId, from, to, uid } = body as {
    agentId: string;
    from: Environment;
    to: Environment;
    uid: string;
  };

  if (!agentId || !from || !to || !uid) {
    return NextResponse.json({ error: "agentId, from, to, uid required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sourceAgent = await db.agent.findUnique({ where: { id: agentId } });
  if (!sourceAgent || sourceAgent.userId !== user.id) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  const newPrefix = to === "staging" ? "staging-" : to === "production" ? "production-" : "";
  const baseCategory = sourceAgent.category
    .replace(/^staging-/, "")
    .replace(/^production-/, "");
  const newCategory = `${newPrefix}${baseCategory}`;

  const promoted = await db.agent.create({
    data: {
      name: sourceAgent.name,
      description: sourceAgent.description,
      icon: sourceAgent.icon,
      category: newCategory,
      nodes: sourceAgent.nodes,
      edges: sourceAgent.edges,
      userId: user.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: `agent.promote:${from}→${to}`,
      resourceType: "agent",
      resourceId: sourceAgent.id,
      meta: JSON.stringify({ promotedId: promoted.id }),
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    promotedAgent: {
      id: promoted.id,
      name: promoted.name,
      category: promoted.category,
    },
    from,
    to,
  });
}
