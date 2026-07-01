import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

interface BulkRequest {
  action: "delete" | "export" | "pin" | "unpin" | "duplicate" | "categorize";
  agentIds: string[];
  category?: string;
  uid?: string;
}

// POST /api/agents/bulk — perform an action on multiple agents at once.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as BulkRequest;
  const { action, agentIds, category, uid } = body;

  if (!action || !Array.isArray(agentIds) || agentIds.length === 0) {
    return NextResponse.json({ error: "action and agentIds required" }, { status: 400 });
  }

  if (agentIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 agents per bulk operation" }, { status: 400 });
  }

  // Look up user for rate limiting (duplicate action creates new agents)
  let user = null;
  if (uid) {
    user = await db.user.findUnique({ where: { firebaseUid: uid } });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  switch (action) {
    case "delete": {
      for (const id of agentIds) {
        try {
          await db.agent.delete({ where: { id } });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "delete failed" });
        }
      }
      break;
    }

    case "export": {
      // Export returns the agents as a JSON download (client handles the file)
      const agents = await db.agent.findMany({ where: { id: { in: agentIds } } });
      return NextResponse.json({
        agents: agents.map((a) => ({
          name: a.name,
          description: a.description,
          icon: a.icon,
          category: a.category,
          nodes: JSON.parse(a.nodes),
          edges: JSON.parse(a.edges),
        })),
      });
    }

    case "pin":
    case "unpin": {
      const pinned = action === "pin";
      for (const id of agentIds) {
        try {
          await db.agent.update({ where: { id }, data: { pinned } });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "update failed" });
        }
      }
      break;
    }

    case "duplicate": {
      if (user) {
        // Check agent limit
        const count = await db.agent.count({ where: { userId: user.id } });
        const plan = (await import("@/lib/plans")).getPlan(user.plan);
        if (count + agentIds.length > plan.maxAgents) {
          return NextResponse.json(
            { error: `Cannot duplicate — would exceed your ${plan.maxAgents} agent limit (${plan.name} plan).` },
            { status: 429 },
          );
        }
      }
      for (const id of agentIds) {
        try {
          const original = await db.agent.findUnique({ where: { id } });
          if (!original) {
            results.push({ id, ok: false, error: "not found" });
            continue;
          }
          const created = await db.agent.create({
            data: {
              name: `${original.name} (copy)`,
              description: original.description,
              icon: original.icon,
              category: original.category,
              nodes: original.nodes,
              edges: original.edges,
              userId: user?.id,
            },
          });
          results.push({ id: created.id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "duplicate failed" });
        }
      }
      break;
    }

    case "categorize": {
      if (!category) {
        return NextResponse.json({ error: "category required for categorize action" }, { status: 400 });
      }
      for (const id of agentIds) {
        try {
          await db.agent.update({ where: { id }, data: { category } });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "update failed" });
        }
      }
      break;
    }

    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    action,
    total: agentIds.length,
    succeeded,
    failed,
    results,
  });
}
