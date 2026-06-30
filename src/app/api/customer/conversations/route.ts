import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// List all customer-mode conversations for a user
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const conversations = await db.customerConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      business: true,
      audience: true,
      tone: true,
      language: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      business: c.business,
      audience: c.audience,
      tone: c.tone,
      language: c.language,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    })),
  );
}

// Create a new customer-mode conversation
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const business = (body.business as string)?.trim() || "Business";
  const audience = (body.audience as string)?.trim() || "Existing customers";
  const tone = (body.tone as string)?.trim() || "friendly";
  const language = (body.language as string)?.trim() || "en";

  const title = `${business} · ${audience}`.slice(0, 120);

  const created = await db.customerConversation.create({
    data: {
      userId: user.id,
      title,
      business,
      audience,
      tone,
      language,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      business: created.business,
      audience: created.audience,
      tone: created.tone,
      language: created.language,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
    { status: 201 },
  );
}
