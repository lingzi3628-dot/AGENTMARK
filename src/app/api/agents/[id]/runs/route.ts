import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toRun } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.runHistory.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(rows.map(toRun));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const created = await db.runHistory.create({
    data: {
      agentId: id,
      input: (body.input as string)?.slice(0, 8000) ?? "",
      output: (body.output as string)?.slice(0, 16000) ?? "",
      status: body.status ?? "completed",
      tokens: body.tokens ?? 0,
      duration: body.duration ?? 0,
    },
  });
  return NextResponse.json(toRun(created), { status: 201 });
}
