import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CustomerMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  meta: string;
  tokens: number;
  createdAt: Date;
}

// Fetch a single conversation + all its messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const conv = await db.customerConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv || conv.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: conv.id,
    title: conv.title,
    business: conv.business,
    audience: conv.audience,
    tone: conv.tone,
    language: conv.language,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: (conv.messages as CustomerMessageRow[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      meta: safeParseMeta(m.meta),
      createdAt: m.createdAt,
    })),
  });
}

// Delete a conversation (messages cascade)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = await db.customerConversation.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.customerConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function safeParseMeta(meta: string): Record<string, unknown> {
  try {
    return meta ? (JSON.parse(meta) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
