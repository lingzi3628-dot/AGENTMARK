import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.knowledgeItem.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
