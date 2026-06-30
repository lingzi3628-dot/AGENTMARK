import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeamRole, TeamAuthError } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string; email: string; photoURL: string } | null;
}

const PAGE_SIZE = 50;

/** GET /api/teams/:id/audit?firebaseUid=<uid>&page=<n> — paginated audit log. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firebaseUid = req.nextUrl.searchParams.get("firebaseUid");
  if (!firebaseUid) return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    await requireTeamRole(user.id, id, "viewer");
  } catch (e) {
    if (e instanceof TeamAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const pageRaw = Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where: { teamId: id },
      include: { user: { select: { id: true, name: true, email: true, photoURL: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    db.auditLog.count({ where: { teamId: id } }),
  ]);

  const entries: AuditEntry[] = rows.map((r) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(r.meta) as Record<string, unknown>;
    } catch {
      meta = {};
    }
    return {
      id: r.id,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      meta,
      createdAt: r.createdAt.toISOString(),
      actor: r.user
        ? {
            id: r.user.id,
            name: r.user.name,
            email: r.user.email,
            photoURL: r.user.photoURL,
          }
        : null,
    };
  });

  return NextResponse.json({
    entries,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
