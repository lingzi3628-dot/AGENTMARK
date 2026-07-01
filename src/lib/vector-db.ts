// Vector database abstraction layer — supports multiple vector stores.
// Currently supports: Pinecone, Qdrant, Weaviate, and the built-in in-memory store.
// Set VECTOR_DB env var to choose: "pinecone" | "qdrant" | "weaviate" | "memory" (default).

import { embed, embedChunks, cosineSimilarity } from "./embeddings";

export type VectorDBType = "pinecone" | "qdrant" | "weaviate" | "memory";

export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, string>;
}

export interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, string>;
}

export interface VectorDB {
  type: VectorDBType;
  upsert(docs: VectorDocument[]): Promise<void>;
  search(query: number[], topK: number, filter?: Record<string, string>): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

export function getVectorDBType(): VectorDBType {
  return (process.env.VECTOR_DB as VectorDBType) || "memory";
}

// === In-Memory Vector Store (default, no setup required) ===

class MemoryVectorDB implements VectorDB {
  type: VectorDBType = "memory";
  private docs: Map<string, VectorDocument> = new Map();

  async upsert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.docs.set(doc.id, doc);
    }
  }

  async search(query: number[], topK: number, filter?: Record<string, string>): Promise<VectorSearchResult[]> {
    const all = Array.from(this.docs.values());
    const filtered = filter
      ? all.filter((d) => Object.entries(filter).every(([k, v]) => d.metadata[k] === v))
      : all;

    const scored = filtered.map((doc) => ({
      id: doc.id,
      text: doc.text,
      score: cosineSimilarity(query, doc.embedding),
      metadata: doc.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.docs.delete(id);
  }

  async count(): Promise<number> {
    return this.docs.size;
  }

  async clear(): Promise<void> {
    this.docs.clear();
  }
}

// === Pinecone Vector Store ===

class PineconeVectorDB implements VectorDB {
  type: VectorDBType = "pinecone";
  private apiKey: string;
  private indexHost: string;

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || "";
    this.indexHost = process.env.PINECONE_INDEX_HOST || "";
    if (!this.apiKey || !this.indexHost) {
      throw new Error("PINECONE_API_KEY and PINECONE_INDEX_HOST required for Pinecone vector DB");
    }
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    const vectors = docs.map((d) => ({
      id: d.id,
      values: d.embedding,
      metadata: { ...d.metadata, text: d.text },
    }));

    await fetch(`https://${this.indexHost}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07",
      },
      body: JSON.stringify({ vectors }),
    });
  }

  async search(query: number[], topK: number, filter?: Record<string, string>): Promise<VectorSearchResult[]> {
    const res = await fetch(`https://${this.indexHost}/query`, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07",
      },
      body: JSON.stringify({
        vector: query,
        topK,
        includeMetadata: true,
        filter: filter || {},
      }),
    });
    const data = await res.json() as { matches?: { id: string; score: number; metadata: { text: string; [k: string]: string } }[] };
    return (data.matches || []).map((m) => ({
      id: m.id,
      text: m.metadata?.text || "",
      score: m.score,
      metadata: m.metadata || {},
    }));
  }

  async delete(ids: string[]): Promise<void> {
    await fetch(`https://${this.indexHost}/vectors/delete`, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07",
      },
      body: JSON.stringify({ ids }),
    });
  }

  async count(): Promise<number> {
    const res = await fetch(`https://${this.indexHost}/describe_index_stats`, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07",
      },
    });
    const data = await res.json() as { totalVectorCount?: number };
    return data.totalVectorCount || 0;
  }

  async clear(): Promise<void> {
    await fetch(`https://${this.indexHost}/vectors/delete`, {
      method: "POST",
      headers: {
        "Api-Key": this.apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07",
      },
      body: JSON.stringify({ deleteAll: true }),
    });
  }
}

// === Qdrant Vector Store ===

class QdrantVectorDB implements VectorDB {
  type: VectorDBType = "qdrant";
  private url: string;
  private apiKey: string;
  private collection: string;

  constructor() {
    this.url = process.env.QDRANT_URL || "";
    this.apiKey = process.env.QDRANT_API_KEY || "";
    this.collection = process.env.QDRANT_COLLECTION || "agentmark";
    if (!this.url) throw new Error("QDRANT_URL required for Qdrant vector DB");
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    const points = docs.map((d) => ({
      id: d.id,
      vector: d.embedding,
      payload: { ...d.metadata, text: d.text },
    }));

    await fetch(`${this.url}/collections/${this.collection}/points?wait=true`, {
      method: "PUT",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ points }),
    });
  }

  async search(query: number[], topK: number, filter?: Record<string, string>): Promise<VectorSearchResult[]> {
    const res = await fetch(`${this.url}/collections/${this.collection}/points/search`, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: query,
        limit: topK,
        with_payload: true,
        filter: filter ? { must: Object.entries(filter).map(([k, v]) => ({ key: k, match: { value: v } })) } : undefined,
      }),
    });
    const data = await res.json() as { result?: { id: string; score: number; payload: { text: string; [k: string]: string } }[] };
    return (data.result || []).map((r) => ({
      id: r.id,
      text: r.payload?.text || "",
      score: r.score,
      metadata: r.payload || {},
    }));
  }

  async delete(ids: string[]): Promise<void> {
    await fetch(`${this.url}/collections/${this.collection}/points/delete?wait=true`, {
      method: "POST",
      headers: { "api-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ points: ids }),
    });
  }

  async count(): Promise<number> {
    const res = await fetch(`${this.url}/collections/${this.collection}`, {
      headers: { "api-key": this.apiKey },
    });
    const data = await res.json() as { result?: { points_count?: number } };
    return data.result?.points_count || 0;
  }

  async clear(): Promise<void> {
    await fetch(`${this.url}/collections/${this.collection}`, {
      method: "DELETE",
      headers: { "api-key": this.apiKey },
    });
  }
}

// === Weaviate Vector Store ===

class WeaviateVectorDB implements VectorDB {
  type: VectorDBType = "weaviate";
  private url: string;
  private apiKey: string;
  private className: string;

  constructor() {
    this.url = process.env.WEAVIATE_URL || "";
    this.apiKey = process.env.WEAVIATE_API_KEY || "";
    this.className = process.env.WEAVIATE_CLASS || "AgentmarkDoc";
    if (!this.url) throw new Error("WEAVIATE_URL required for Weaviate vector DB");
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      await fetch(`${this.url}/v1/objects`, {
        method: "POST",
        headers: {
          Authorization: this.apiKey ? `Bearer ${this.apiKey}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class: this.className,
          id: doc.id,
          properties: { ...doc.metadata, text: doc.text },
          vector: doc.embedding,
        }),
      });
    }
  }

  async search(query: number[], topK: number, _filter?: Record<string, string>): Promise<VectorSearchResult[]> {
    const res = await fetch(`${this.url}/v1/graphql`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey ? `Bearer ${this.apiKey}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{
          Get {
            ${this.className}(nearVector: { vector: ${JSON.stringify(query)} }, limit: ${topK}) {
              text
              _additional { id distance }
            }
          }
        }`,
      }),
    });
    const data = await res.json() as { data?: { Get?: Record<string, { text: string; _additional: { id: string; distance: number } }[]> } };
    const results = data.data?.Get?.[this.className] || [];
    return results.map((r) => ({
      id: r._additional.id,
      text: r.text,
      score: 1 - r._additional.distance,
      metadata: {},
    }));
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      await fetch(`${this.url}/v1/objects/${this.className}/${id}`, {
        method: "DELETE",
        headers: { Authorization: this.apiKey ? `Bearer ${this.apiKey}` : "" },
      });
    }
  }

  async count(): Promise<number> {
    const res = await fetch(`${this.url}/v1/graphql`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey ? `Bearer ${this.apiKey}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{ Aggregate { ${this.className} { meta { count } } } }`,
      }),
    });
    const data = await res.json() as { data?: { Aggregate?: Record<string, { meta: { count: number } }[]> } };
    return data.data?.Aggregate?.[this.className]?.[0]?.meta?.count || 0;
  }

  async clear(): Promise<void> {
    // Weaviate doesn't have a simple "delete all" — would need to query + delete
    console.log("[weaviate] clear() not implemented — delete collection manually");
  }
}

// === Factory ===

let _instance: VectorDB | null = null;

export function getVectorDB(): VectorDB {
  if (_instance) return _instance;

  const type = getVectorDBType();
  switch (type) {
    case "pinecone":
      _instance = new PineconeVectorDB();
      break;
    case "qdrant":
      _instance = new QdrantVectorDB();
      break;
    case "weaviate":
      _instance = new WeaviateVectorDB();
      break;
    case "memory":
    default:
      _instance = new MemoryVectorDB();
      break;
  }

  console.log(`[vector-db] Using: ${type}`);
  return _instance;
}

/**
 * Index documents into the vector DB.
 * Chunks each document, embeds each chunk, and upserts.
 */
export async function indexDocuments(
  docs: { id: string; text: string; metadata: Record<string, string> }[],
): Promise<number> {
  const db = getVectorDB();
  const allVectors: VectorDocument[] = [];

  for (const doc of docs) {
    const chunks = await embedChunks([doc.text]);
    chunks[0]?.forEach((embedding, i) => {
      allVectors.push({
        id: `${doc.id}-chunk-${i}`,
        text: doc.text.slice(i * 500, (i + 1) * 500),
        embedding,
        metadata: { ...doc.metadata, docId: doc.id, chunkIndex: String(i) },
      });
    });
  }

  await db.upsert(allVectors);
  return allVectors.length;
}

/**
 * Search the vector DB with a text query.
 */
export async function vectorSearch(
  query: string,
  topK: number = 4,
  filter?: Record<string, string>,
): Promise<VectorSearchResult[]> {
  const db = getVectorDB();
  const queryEmbedding = await embed(query);
  return db.search(queryEmbedding, topK, filter);
}
