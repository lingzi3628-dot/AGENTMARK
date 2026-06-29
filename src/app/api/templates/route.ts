import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTemplate } from "@/lib/serialize";
import { DEFAULT_TEMPLATES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  let rows = await db.template.findMany({ orderBy: [{ featured: "desc" }, { installs: "desc" }] });
  // Seed defaults if empty
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
    rows = await db.template.findMany({ orderBy: [{ featured: "desc" }, { installs: "desc" }] });
  }
  return NextResponse.json(rows.map(toTemplate));
}
