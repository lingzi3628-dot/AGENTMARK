import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TemplateShare, WorkflowNode, WorkflowEdge } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TemplateShareRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string;
  nodes: string;
  edges: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string;
  installs: number;
  rating: number;
  ratingCount: number;
  priceCents: number;
  published: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function toTemplateShare(r: TemplateShareRow): TemplateShare {
  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];
  try {
    nodes = JSON.parse(r.nodes) as WorkflowNode[];
  } catch {
    nodes = [];
  }
  try {
    edges = JSON.parse(r.edges) as WorkflowEdge[];
  } catch {
    edges = [];
  }
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    icon: r.icon,
    category: r.category,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    nodes,
    edges,
    authorId: r.authorId ?? "",
    authorName: r.authorName,
    authorAvatar: r.authorAvatar,
    installs: r.installs,
    rating: r.rating,
    ratingCount: r.ratingCount,
    priceCents: r.priceCents,
    published: r.published,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

/**
 * GET /api/marketplace?category=&q=&sort=installs|rating|recent&page=&limit=
 * Returns a paginated list of published templates. 20 per page default.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category")?.trim() || "";
  const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
  const sort = (url.searchParams.get("sort")?.trim() || "installs") as
    | "installs"
    | "rating"
    | "recent";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20));

  // Build where clause
  const where: { published: boolean; category?: string; OR?: unknown[] } = {
    published: true,
  };
  if (category && category !== "all") where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { tags: { contains: q } },
      { authorName: { contains: q } },
    ];
  }

  const orderBy =
    sort === "rating"
      ? ([{ rating: "desc" as const }, { ratingCount: "desc" as const }])
      : sort === "recent"
        ? [{ createdAt: "desc" as const }]
        : [{ installs: "desc" as const }, { rating: "desc" as const }];

  const [rows, total] = await Promise.all([
    db.templateShare.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.templateShare.count({ where }),
  ]);

  const items = rows.map(toTemplateShare);

  return NextResponse.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
