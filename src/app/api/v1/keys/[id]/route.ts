import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_SCOPES = ["agents:read", "agents:run", "agents:write", "templates:read"];

/** Resolve the firebaseUid parameter (query string for DELETE, body for PATCH). */
async function resolveUid(req: NextRequest, body: Record<string, unknown>): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get("firebaseUid");
  if (fromQuery) return fromQuery;
  if (typeof body.firebaseUid === "string") return body.firebaseUid;
  return null;
}

/** PATCH /api/v1/keys/:id {firebaseUid, isActive?, scopes?} — toggle active / update scopes. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const firebaseUid = await resolveUid(req, body);
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: { isActive?: boolean; scopes?: string } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Array.isArray(body.scopes)) {
    const scopes = body.scopes.filter((s): s is string => typeof s === "string" && ALLOWED_SCOPES.includes(s));
    if (scopes.length === 0) {
      return NextResponse.json({ error: `scopes must be a non-empty subset of: ${ALLOWED_SCOPES.join(", ")}` }, { status: 400 });
    }
    data.scopes = scopes.join(",");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = await db.apiKey.update({ where: { id }, data });
  return NextResponse.json({
    id: updated.id,
    label: updated.label,
    prefix: updated.prefix,
    scopes: updated.scopes.split(",").map((s) => s.trim()).filter(Boolean),
    isActive: updated.isActive,
    lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  });
}

/** DELETE /api/v1/keys/:id?firebaseUid=<uid> — permanently revoke a key. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firebaseUid = req.nextUrl.searchParams.get("firebaseUid");
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.apiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
