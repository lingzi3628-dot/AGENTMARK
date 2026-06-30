import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.agent.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toAgent(row));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const existing = await db.agent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.agent.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      icon: body.icon ?? existing.icon,
      category: body.category ?? existing.category,
      pinned: body.pinned ?? existing.pinned,
      nodes: body.nodes ? JSON.stringify(body.nodes) : existing.nodes,
      edges: body.edges ? JSON.stringify(body.edges) : existing.edges,
    },
  });
  return NextResponse.json(toAgent(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.agent.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
