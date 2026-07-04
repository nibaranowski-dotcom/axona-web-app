// FILE.2 — the Embedder DI, mirroring ART.1's ModelClient (Anthropic vs Fake).
// A swappable 1536-dim embedder so the capture substrate (text → vectors) can
// improve without a rewrite; the pipeline + semanticSearch run offline/CI with
// the deterministic FakeEmbedder (no provider key, no network).

export const EMBED_DIM = 1536;

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  readonly dim: number;
}

function l2normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

// Deterministic hash → 1536-vector, L2-normalized. Stable for the same input, so
// dev/CI produce reproducible ranking. Not semantically meaningful — a stand-in
// for the real model; swap via getEmbedder() when EMBED_API_KEY is set.
export class FakeEmbedder implements Embedder {
  readonly dim = EMBED_DIM;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.one(t));
  }
  private one(text: string): number[] {
    const out = new Array<number>(EMBED_DIM);
    // xorshift-ish PRNG seeded per dimension from the text — cheap + deterministic.
    for (let i = 0; i < EMBED_DIM; i++) {
      let h = 2166136261 ^ i;
      for (let k = 0; k < text.length; k++) {
        h ^= text.charCodeAt(k);
        h = Math.imul(h, 16777619);
      }
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
      out[i] = ((h >>> 0) / 0xffffffff) * 2 - 1; // [-1, 1)
    }
    return l2normalize(out);
  }
}

// Provider embedder via raw fetch (no SDK dep) — OpenAI-compatible embeddings at
// 1536 dims. Selected only when EMBED_API_KEY is set. Batches inputs; the caller
// caps input length. Falls back to throwing on a hard error (the processor
// catches per-file).
export class RealEmbedder implements Embedder {
  readonly dim = EMBED_DIM;
  constructor(
    private readonly apiKey = process.env.EMBED_API_KEY ?? "",
    private readonly model = process.env.EMBED_MODEL ??
      "text-embedding-3-small",
    private readonly baseUrl = process.env.EMBED_BASE_URL ??
      "https://api.openai.com/v1",
  ) {}
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: EMBED_DIM,
      }),
    });
    if (!res.ok) throw new Error(`embedder ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

/** Pick real-vs-fake by env, exactly like AnthropicModelClient vs FakeModelClient. */
export function getEmbedder(): Embedder {
  return process.env.EMBED_API_KEY ? new RealEmbedder() : new FakeEmbedder();
}

/** pgvector literal for a raw-SQL write: '[0.1,0.2,…]'. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
