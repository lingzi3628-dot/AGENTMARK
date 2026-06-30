import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiRequest, hasScope } from "@/lib/api-auth";
import { toTemplate } from "@/lib/serialize";
import { DEFAULT_TEMPLATES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** GET /api/v1/templates — list marketplace templates. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 });
  }
  if (!hasScope(user, "templates:read")) {
    return NextResponse.json({ error: "Insufficient scope (requires templates:read)" }, { status: 403 });
  }

  let rows = await db.template.findMany({
    orderBy: [{ featured: "desc" }, { installs: "desc" }],
  });
  // Seed defaults if the DB is empty (mirrors /api/templates behaviour).
  if (rows.length === 0) {
    await db.template.createMany({
      data: DEFAULT_TEMPLATES.map((t) => ({
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        tags: t.tags.join(","),
        nodes: JSON.stringify(t.nodes),
        edges: JSON.stringify(t.edges),
        featured: t.featured,
      })),
    });
    rows = await db.template.findMany({
      orderBy: [{ featured: "desc" }, { installs: "desc" }],
    });
  }
  return NextResponse.json(rows.map(toTemplate));
}
