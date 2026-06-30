import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";
import { toAgent } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:read")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:read)" }, { status: 403 });
  }
  const row = await db.agent.findUnique({ where: { id } });
  if (!row || row.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toAgent(row));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:write")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:write)" }, { status: 403 });
  }
  const existing = await db.agent.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updated = await db.agent.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name : existing.name,
      description: typeof body.description === "string" ? body.description : existing.description,
      icon: typeof body.icon === "string" ? body.icon : existing.icon,
      category: typeof body.category === "string" ? body.category : existing.category,
      pinned: typeof body.pinned === "boolean" ? body.pinned : existing.pinned,
      nodes: Array.isArray(body.nodes) ? JSON.stringify(body.nodes) : existing.nodes,
      edges: Array.isArray(body.edges) ? JSON.stringify(body.edges) : existing.edges,
    },
  });
  return NextResponse.json(toAgent(updated));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "agents:write")) {
    return NextResponse.json({ error: "Insufficient scope (requires agents:write)" }, { status: 403 });
  }
  const existing = await db.agent.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
