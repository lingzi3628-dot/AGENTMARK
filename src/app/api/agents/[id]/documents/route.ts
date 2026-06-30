import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunkText, embedChunks } from "@/lib/embeddings";
import type { AgentDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_DOCS_PER_AGENT = 25;
const MAX_CONTENT_CHARS = 100_000;

interface StoredChunk {
  chunk: string;
  embedding: number[];
}

function toAgentDocument(row: {
  id: string;
  agentId: string;
  title: string;
  content: string;
  source: string;
  type: string;
  chunkCount: number;
  createdAt: Date;
}): AgentDocument {
  return {
    id: row.id,
    agentId: row.agentId,
    title: row.title,
    content: row.content,
    source: row.source,
    type: row.type as AgentDocument["type"],
    chunkCount: row.chunkCount,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/agents/[id]/documents
// Lists all documents uploaded to this agent (used by the Knowledge view's
// "Documents (RAG)" section). Returns metadata only — chunks are kept
// server-side and never sent to the client (they're large + contain
// embedding vectors).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const docs = await db.document.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs.map(toAgentDocument));
}

// POST /api/agents/[id]/documents
// Body: { title, content, source?, type? }
// Chunks the content (~256-token pieces at sentence boundaries), embeds
// each chunk with all-MiniLM-L6-v2, and stores the chunk+embedding pairs
// as a JSON string on the Document row.
//
// Caps: 25 docs per agent, content > 100K chars truncated.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body.title as string)?.trim().slice(0, 200);
  const rawContent = (body.content as string)?.trim() ?? "";
  const source = (body.source as string)?.trim().slice(0, 500) ?? "";
  const type = ((body.type as string) ?? "text") as AgentDocument["type"];

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!rawContent) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!["text", "url", "markdown", "pdf"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  // 25-doc cap per agent
  const existing = await db.document.count({ where: { agentId: id } });
  if (existing >= MAX_DOCS_PER_AGENT) {
    return NextResponse.json(
      { error: `Document limit reached (${MAX_DOCS_PER_AGENT} per agent). Delete one to add more.` },
      { status: 429 },
    );
  }

  // Truncate huge files to keep embedding time bounded.
  const content = rawContent.length > MAX_CONTENT_CHARS
    ? rawContent.slice(0, MAX_CONTENT_CHARS)
    : rawContent;

  // Chunk + embed. This is the slow step (~1s per 1K tokens of content).
  const chunks = chunkText(content, 256);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "No chunks could be extracted from content" }, { status: 400 });
  }

  let embedded: StoredChunk[] = [];
  try {
    const vectors = await embedChunks(chunks);
    embedded = chunks.map((chunk, i) => ({ chunk, embedding: vectors[i] ?? [] }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "embedding failed";
    return NextResponse.json(
      { error: `Failed to embed document: ${msg}` },
      { status: 500 },
    );
  }

  const created = await db.document.create({
    data: {
      agentId: id,
      title,
      content,
      source,
      type,
      chunks: JSON.stringify(embedded),
      chunkCount: embedded.length,
    },
  });
  return NextResponse.json(toAgentDocument(created), { status: 201 });
}
