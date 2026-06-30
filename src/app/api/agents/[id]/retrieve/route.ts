import { NextRequest, NextResponse } from "next/server";
import { retrieveContext } from "@/lib/rag";
import { db } from "@/lib/db";
import type { RetrievedChunk } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RetrieveBody {
  query: string;
  topK?: number;
}

interface RetrieveResponse {
  chunks: RetrievedChunk[];
}

// POST /api/agents/[id]/retrieve
// Body: { query, topK? }
// Embeds the query, ranks all chunks across the agent's documents by cosine
// similarity, and returns the top K matches. Default topK=4, range 1-10.
//
// This route is used directly by external callers (e.g. a "Test retrieval"
// button in the Knowledge view). When a knowledge node has useRAG=true,
// executeAgent() calls retrieveContext() inline instead — same logic.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as RetrieveBody;
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const topK = Math.max(1, Math.min(10, body.topK ?? 4));

  const chunks = await retrieveContext(id, query, topK);
  const res: RetrieveResponse = { chunks };
  return NextResponse.json(res);
}
