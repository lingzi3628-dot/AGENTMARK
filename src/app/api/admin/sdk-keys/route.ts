import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminGuard } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/sdk-keys?key=<ADMIN_SECRET_KEY>
// List all SDK API keys (for managing registrations).
export async function GET(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const keys = await db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { email: true, name: true },
      },
    },
  });

  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.prefix,
      scopes: k.scopes,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt?.toISOString() || null,
      createdAt: k.createdAt.toISOString(),
      userEmail: k.user.email,
      userName: k.user.name,
    })),
    total: keys.length,
    active: keys.filter((k) => k.isActive).length,
  });
}

// DELETE /api/admin/sdk-keys?id=<keyId>&key=<ADMIN_SECRET_KEY>
// Revoke an API key.
export async function DELETE(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const keyId = req.nextUrl.searchParams.get("id");
  if (!keyId) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.apiKey.delete({ where: { id: keyId } });

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/sdk-keys?key=<ADMIN_SECRET_KEY>
// Toggle key active/inactive.
export async function PATCH(req: NextRequest) {
  const guard = adminGuard(req);
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const { id, isActive } = body as { id: string; isActive: boolean };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await db.apiKey.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json({ ok: true, isActive: updated.isActive });
}
