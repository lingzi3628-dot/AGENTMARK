import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/webhooks/log?uid=<firebaseUid>&platform=&limit=&offset=
// Returns a unified log of all webhook events across all of the user's agents.
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const platform = req.nextUrl.searchParams.get("platform") || undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "50"), 200);
  const offset = Number(req.nextUrl.searchParams.get("offset") || "0");

  // Find all of the user's agents
  const agents = await db.agent.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const agentIds = agents.map((a) => a.id);

  if (agentIds.length === 0) {
    return NextResponse.json({ events: [], total: 0 });
  }

  // Find all integrations for those agents
  const integrations = await db.integration.findMany({
    where: { agentId: { in: agentIds } },
    select: { id: true, platform: true, agentId: true },
  });
  const integrationIds = integrations.map((i) => i.id);

  if (integrationIds.length === 0) {
    return NextResponse.json({ events: [], total: 0 });
  }

  // Build filter
  const where: { integrationId: { in: string[] }; platform?: string } = {
    integrationId: { in: integrationIds },
  };
  if (platform) {
    where.platform = platform;
  }

  const [messages, total] = await Promise.all([
    db.messageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.messageLog.count({ where }),
  ]);

  // Group by conversation (senderId) to show request/response pairs
  const integrationMap = new Map(integrations.map((i) => [i.id, i]));

  return NextResponse.json({
    events: messages.map((m) => {
      const integ = integrationMap.get(m.integrationId);
      return {
        id: m.id,
        integrationId: m.integrationId,
        platform: m.platform,
        agentId: integ?.agentId || "",
        direction: m.direction,
        senderName: m.senderName,
        senderId: m.senderId,
        content: m.content.slice(0, 500),
        status: m.status,
        tokens: m.tokens,
        costCents: m.costCents,
        durationMs: m.durationMs,
        createdAt: m.createdAt.toISOString(),
      };
    }),
    total,
    offset,
    limit,
    platforms: [...new Set(integrations.map((i) => i.platform))],
  });
}
