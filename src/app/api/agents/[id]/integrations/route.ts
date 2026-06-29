import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.integration.findMany({ where: { agentId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      platform: r.platform,
      config: safeParse(r.config),
      enabled: r.enabled,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    })),
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const platform = body.platform as string;
  const config = body.config ?? {};
  if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

  const created = await db.integration.create({
    data: { agentId: id, platform, config: JSON.stringify(config), enabled: true },
  });
  return NextResponse.json({
    id: created.id, agentId: created.agentId, platform: created.platform,
    config: safeParse(created.config), enabled: created.enabled,
    createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString(),
  }, { status: 201 });
}

function safeParse(s: string): Record<string, string> {
  try { return JSON.parse(s) as Record<string, string>; } catch { return {}; }
}
