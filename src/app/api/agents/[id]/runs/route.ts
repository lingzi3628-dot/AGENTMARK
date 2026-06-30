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
      // V2 cost tracking — populated from the SSE __cost__ event emitted by
      // /api/agents/[id]/run. The client forwards costCents + source here
      // when persisting the run record. Defaults to 0 cents + "manual"
      // source so older clients still work.
      costCents: typeof body.costCents === "number" ? body.costCents : 0,
      source: typeof body.source === "string" && body.source ? body.source : "manual",
    },
  });
  return NextResponse.json(toRun(created), { status: 201 });
}
