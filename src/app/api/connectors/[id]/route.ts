import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/connectors/[id]?uid=<firebaseUid> — disconnect a provider
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = await db.oAuthToken.findUnique({ where: { id } });
  if (!token || token.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.oAuthToken.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/connectors/[id] — toggle active/inactive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = await db.oAuthToken.findUnique({ where: { id } });
  if (!token || token.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await db.oAuthToken.update({
    where: { id },
    data: { isActive: body.isActive !== undefined ? !!body.isActive : token.isActive },
  });

  return NextResponse.json({
    id: updated.id,
    provider: updated.provider,
    isActive: updated.isActive,
  });
}
