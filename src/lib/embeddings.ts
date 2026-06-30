/**
 * RAG embeddings using @xenova/transformers (Xenova/all-MiniLM-L6-v2, 384-dim).
 *
 * The model is lazily loaded on first use (~80MB) and cached at module scope.
 * Xenova runs in Node.js via onnxruntime-node. We disable local model loading
 * + browser cache so the model is fetched from the HuggingFace CDN.
 *
 * This module is server-side only — never import from a Client Component.
 */

import type { Pipeline, PreTrainedModel } from "@xenova/transformers";

// Module-level singleton — only initialized on first embed() call.
let _pipeline: Pipeline | null = null;
let _loading: Promise<Pipeline> | null = null;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const EMBED_DIM = 384;

/** Lazy-load the feature-extraction pipeline (singleton). */
async function getPipeline(): Promise<Pipeline> {
  if (_pipeline) return _pipeline;
  if (_loading) return _loading;

  _loading = (async () => {
    // Dynamic import so the heavy ONNX runtime only loads when needed.
    const { pipeline, env } = await import("@xenova/transformers");
    // Prevent the model loader from looking for local files / using browser cache.
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    // Backends: prefer onnxruntime-node for server-side inference.
    // (Xenova picks this up automatically when available — but be explicit.)
    if (typeof env.backends === "object" && env.backends) {
      // No-op — kept defensive in case the env shape changes.
    }
    const pipe = (await pipeline("feature-extraction", MODEL_ID, {
      quantized: true, // smaller + faster, fine for retrieval
    })) as Pipeline;
    _pipeline = pipe;
    return pipe;
  })();

  return _loading;
}

/**
 * Embed a single text using mean pooling + L2 normalization.
 * Returns a 384-dim float array.
 */
export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = (await pipe(text, {
    pooling: "mean",
    normalize: true,
  })) as { data: Float32Array | number[]; dims?: number[] };
  const arr = output.data instanceof Float32Array
    ? Array.from(output.data)
    : (output.data as number[]);
  // Defensive — trim/pad to EMBED_DIM just in case the model returns unexpected shape.
  if (arr.length > EMBED_DIM) return arr.slice(0, EMBED_DIM);
  if (arr.length < EMBED_DIM) return arr.concat(new Array(EMBED_DIM - arr.length).fill(0));
  return arr;
}

/**
 * Embed multiple texts in a single batch (more efficient than calling embed()
 * N times — Xenova supports tensorized batch inference).
 */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [await embed(texts[0])];
  // Embed in chunks of 8 to keep memory bounded.
  const BATCH = 8;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    // Use the pipeline's tensorized batch path.
    const pipe = await getPipeline();
    const output = (await pipe(slice, {
      pooling: "mean",
      normalize: true,
    })) as { data: Float32Array | number[]; dims?: number[] };
    const arr = output.data instanceof Float32Array
      ? Array.from(output.data)
      : (output.data as number[]);
    const total = arr.length;
    const perItem = total / slice.length;
    for (let j = 0; j < slice.length; j++) {
      let vec = arr.slice(j * perItem, (j + 1) * perItem);
      if (vec.length > EMBED_DIM) vec = vec.slice(0, EMBED_DIM);
      else if (vec.length < EMBED_DIM) vec = vec.concat(new Array(EMBED_DIM - vec.length).fill(0));
      out.push(vec);
    }
  }
  return out;
}

/**
 * Split a long text into ~256-token chunks at sentence boundaries.
 * Uses a simple regex-based sentence splitter (no external deps).
 * Approximates "tokens" by characters / 4 (standard heuristic).
 */
export function chunkText(text: string, maxTokens = 256): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const maxChars = maxTokens * 4; // ~4 chars/token heuristic

  // Split on sentence boundaries: ., !, ? followed by whitespace/newline.
  const sentenceEnd = /(?<=[.!?])\s+|\n{2,}/g;
  const rawSentences = cleaned
    .split(sentenceEnd)
    .map((s) => s.trim())
    .filter(Boolean);

  // If splitting yielded nothing useful, fall back to character slicing.
  if (rawSentences.length === 0) {
    if (cleaned.length <= maxChars) return [cleaned];
    const chunks: string[] = [];
    for (let i = 0; i < cleaned.length; i += maxChars) {
      chunks.push(cleaned.slice(i, i + maxChars));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let buf = "";
  for (const sentence of rawSentences) {
    // If a single sentence is longer than maxChars, hard-split it.
    if (sentence.length > maxChars) {
      if (buf) {
        chunks.push(buf.trim());
        buf = "";
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars).trim());
      }
      continue;
    }
    const candidate = buf ? `${buf} ${sentence}` : sentence;
    if (candidate.length > maxChars) {
      if (buf) chunks.push(buf.trim());
      buf = sentence;
    } else {
      buf = candidate;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

/** Cosine similarity for two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** For sanity checks / health endpoints — exposes the configured dimension. */
export function embedDimension(): number {
  return EMBED_DIM;
}

/** Test the model is reachable — used by diagnostics. Returns true on success. */
export async function pingEmbedder(): Promise<boolean> {
  try {
    const v = await embed("ping");
    return v.length === EMBED_DIM;
  } catch {
    return false;
  }
}

// Keep an unused export of PreTrainedModel type to satisfy potential type imports.
export type { PreTrainedModel };
