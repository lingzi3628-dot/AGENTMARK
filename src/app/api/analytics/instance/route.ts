import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/analytics/instance?uid=<firebaseUid>
// Returns analytics data for a specific user's instances (for the user themselves)
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Return the user's usage stats
  const agentCount = await db.agent.count({ where: { userId: user.id } });
  const runCount = await db.runHistory.count({ where: { userId: user.id } });
  const integrationCount = await db.integration.count({
    where: { agent: { userId: user.id } },
  });

  return NextResponse.json({
    instanceId: user.id,
    stats: {
      agents: agentCount,
      runs: runCount,
      integrations: integrationCount,
      plan: user.plan,
      tokensUsedToday: user.tokensUsedToday,
      tokensLimit: user.dailyTokenLimit,
    },
    analyticsEnabled: false, // TODO: store this preference
  });
}
