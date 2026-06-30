/**
 * RAG retrieval service — shared by the /api/agents/[id]/retrieve route
 * and by executeAgent() when a knowledge node has useRAG=true.
 *
 * Server-side only.
 */

import { db } from "@/lib/db";
import { embed, cosineSimilarity } from "@/lib/embeddings";
import type { RetrievedChunk } from "@/lib/types";

interface StoredChunk {
  chunk: string;
  embedding: number[];
}

/**
 * Retrieve the top-K most relevant chunks for a query from an agent's
 * document store. Embeds the query, then ranks all chunks by cosine
 * similarity and returns the top K.
 */
export async function retrieveContext(
  agentId: string,
  query: string,
  topK = 4,
): Promise<RetrievedChunk[]> {
  const k = Math.max(1, Math.min(10, topK));
  const trimmed = query.trim().slice(0, 2000);
  if (!trimmed) return [];

  const docs = await db.document.findMany({
    where: { agentId },
    select: { title: true, chunks: true },
  });
  if (docs.length === 0) return [];

  // Flatten all chunks across docs with their parent title.
  type Flat = { docTitle: string; chunk: string; embedding: number[] };
  const flat: Flat[] = [];
  for (const doc of docs) {
    let parsed: StoredChunk[] = [];
    try {
      parsed = JSON.parse(doc.chunks) as StoredChunk[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }
    for (const c of parsed) {
      if (c && typeof c.chunk === "string" && Array.isArray(c.embedding)) {
        flat.push({ docTitle: doc.title, chunk: c.chunk, embedding: c.embedding });
      }
    }
  }
  if (flat.length === 0) return [];

  // Embed the query once.
  const qVec = await embed(trimmed);

  // Rank + pick top-K.
  const scored = flat
    .map((f) => ({
      docTitle: f.docTitle,
      chunk: f.chunk,
      score: cosineSimilarity(qVec, f.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}

/**
 * Format retrieved chunks as a single text block suitable for prepending
 * to a model's system prompt or user content.
 */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map((c, i) => {
    const scorePct = Math.round(c.score * 100);
    return `### ${i + 1}. ${c.docTitle} (relevance ${scorePct}%)\n${c.chunk}`;
  });
  return `Retrieved from knowledge base:\n\n${lines.join("\n\n")}`;
}
