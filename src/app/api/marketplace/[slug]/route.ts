import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toAgent } from "@/lib/serialize";
import { toTemplateShare } from "../route";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/[slug]
 * Returns a single published template by slug.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const row = await db.templateShare.findUnique({ where: { slug } });
  if (!row || !row.published) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }
  return NextResponse.json(toTemplateShare(row));
}

/**
 * POST /api/marketplace/[slug]/install
 * Body: { firebaseUid }
 * Clones the template into the user's agents. Checks maxAgents limit.
 * Increments the template's installs counter.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as { firebaseUid?: string };
  const firebaseUid = body.firebaseUid;

  if (!firebaseUid) {
    return NextResponse.json(
      { error: "firebaseUid required" },
      { status: 400 },
    );
  }

  const tpl = await db.templateShare.findUnique({ where: { slug } });
  if (!tpl || !tpl.published) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  // Enforce 2-agent (or plan-tier) limit
  const count = await db.agent.count({ where: { userId: user.id } });
  if (count >= user.maxAgents) {
    return NextResponse.json(
      {
        error: `Agent limit reached (${user.maxAgents}). Delete an unused agent or upgrade your plan.`,
      },
      { status: 429 },
    );
  }

  // Clone the graph into a new agent owned by this user.
  const created = await db.agent.create({
    data: {
      name: tpl.name,
      description: tpl.description,
      icon: tpl.icon,
      category: tpl.category,
      nodes: tpl.nodes,
      edges: tpl.edges,
      userId: user.id,
      publishedTemplateId: tpl.id,
    },
  });

  // Bump installs (best-effort; ignore race conditions for the counter)
  await db.templateShare
    .update({
      where: { id: tpl.id },
      data: { installs: { increment: 1 } },
    })
    .catch(() => undefined);

  return NextResponse.json(toAgent(created), { status: 201 });
}
