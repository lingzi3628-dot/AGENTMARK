import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toKnowledge } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.knowledgeItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows.map(toKnowledge));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = (body.title as string)?.trim() || "Untitled";
  const content = (body.content as string)?.trim() || "";
  const type = body.type || "text";
  const source = body.source || "";
  const agentId = body.agentId || null;

  const created = await db.knowledgeItem.create({
    data: { title, content, type, source, agentId: agentId ?? null },
  });
  return NextResponse.json(toKnowledge(created), { status: 201 });
}
