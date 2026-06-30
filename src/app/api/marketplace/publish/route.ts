import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PublishBody {
  agentId?: string;
  slug?: string;
  description?: string;
  category?: string;
  tags?: string | string[];
  priceCents?: number;
  firebaseUid?: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * POST /api/marketplace/publish
 * Publishes an agent to the marketplace as a TemplateShare.
 *
 * Body:
 *   agentId      — required, the agent to publish
 *   slug         — required, unique URL slug (auto-cleaned)
 *   description  — optional, falls back to agent.description
 *   category     — optional, defaults to "custom"
 *   tags         — optional, comma-separated string OR string[]
 *   priceCents   — optional, 0 = free, >0 = paid (Stripe handled elsewhere)
 *   firebaseUid  — required, the publishing user
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as PublishBody;
  const {
    agentId,
    slug: rawSlug,
    description,
    category,
    tags,
    priceCents,
    firebaseUid,
  } = body;

  if (!agentId || !firebaseUid) {
    return NextResponse.json(
      { error: "agentId and firebaseUid are required" },
      { status: 400 },
    );
  }

  const slug = slugify(rawSlug ?? "");
  if (!slug) {
    return NextResponse.json(
      { error: "A valid slug is required (letters, numbers, hyphens)" },
      { status: 400 },
    );
  }

  // Validate uniqueness
  const existing = await db.templateShare.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Slug "${slug}" is already taken. Try another.` },
      { status: 409 },
    );
  }

  // Load user + agent
  const [user, agent] = await Promise.all([
    db.user.findUnique({ where: { firebaseUid } }),
    db.agent.findUnique({ where: { id: agentId } }),
  ]);
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }
  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 },
    );
  }
  // Only the owner can publish their agent
  if (agent.userId && agent.userId !== user.id) {
    return NextResponse.json(
      { error: "You can only publish your own agents" },
      { status: 403 },
    );
  }

  // Normalize tags
  const tagStr = Array.isArray(tags)
    ? tags.join(",")
    : typeof tags === "string"
      ? tags
      : "";

  // Clamp price
  const price =
    typeof priceCents === "number" && priceCents > 0
      ? Math.min(Math.floor(priceCents), 1_000_000) // cap at $10,000
      : 0;

  const created = await db.templateShare.create({
    data: {
      slug,
      name: agent.name,
      description: description?.trim() || agent.description,
      icon: agent.icon,
      category: category?.trim() || agent.category || "custom",
      tags: tagStr,
      nodes: agent.nodes,
      edges: agent.edges,
      authorId: user.id,
      authorName: user.name || user.email.split("@")[0],
      authorAvatar: user.photoURL || "",
      priceCents: price,
      published: true,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      slug: created.slug,
      url: `/marketplace/${created.slug}`,
    },
    { status: 201 },
  );
}
