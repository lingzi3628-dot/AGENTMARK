import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, maskKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Update a custom API entry (rotate key, toggle active, edit label)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  if (!uid) return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = await db.customApi.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = String(body.label).trim();
  if (body.provider !== undefined) data.provider = String(body.provider).trim();
  if (body.baseUrl !== undefined) data.baseUrl = String(body.baseUrl).trim();
  if (body.modelName !== undefined) data.modelName = String(body.modelName).trim();
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    data.encryptedKey = encrypt(body.apiKey.trim());
    data.maskedKey = maskKey(body.apiKey.trim());
  }

  const updated = await db.customApi.update({ where: { id }, data });
  return NextResponse.json({
    id: updated.id,
    label: updated.label,
    provider: updated.provider,
    baseUrl: updated.baseUrl,
    modelName: updated.modelName,
    maskedKey: updated.maskedKey,
    isActive: updated.isActive,
  });
}

// Delete a custom API entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = await db.customApi.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.customApi.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// Test an API entry (sends a tiny ping request — useful for verifying the key works)
export async function POST_ping(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // reserved for future use
  return NextResponse.json({ error: "not implemented" }, { status: 501 });
}
