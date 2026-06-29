import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// Get publish status
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pub = await db.publishedAgent.findUnique({ where: { agentId: id } });
  return NextResponse.json({ published: !!pub, slug: pub?.slug ?? null, enabled: pub?.enabled ?? false });
}

// Publish (create or update slug)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const slug = (body.slug as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60) ||
    `${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${id.slice(-4)}`;

  const existing = await db.publishedAgent.findUnique({ where: { agentId: id } });
  if (existing) {
    const updated = await db.publishedAgent.update({ where: { agentId: id }, data: { slug, enabled: true } });
    return NextResponse.json({ slug: updated.slug, enabled: updated.enabled });
  }
  // ensure slug unique
  let finalSlug = slug;
  let n = 1;
  while (await db.publishedAgent.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slug}-${n++}`;
  }
  const created = await db.publishedAgent.create({ data: { agentId: id, slug: finalSlug, enabled: true } });
  return NextResponse.json({ slug: created.slug, enabled: created.enabled }, { status: 201 });
}

// Unpublish
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.publishedAgent.delete({ where: { agentId: id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

void toAgent;
