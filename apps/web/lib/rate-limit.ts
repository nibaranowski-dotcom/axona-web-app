// LEAD.1 — a small in-memory sliding-window rate limiter for the PUBLIC /api/leads
// endpoint. Per-key (hashed IP) AND a global ceiling, so neither a single source nor
// a distributed burst can flood the Lead table. In-memory is intentional for this
// slice: it resets on redeploy and is per-instance — enough to blunt abuse of a
// low-volume contact form. A Redis-backed limiter (shared across replicas) is the
// hardening follow-up; the interface here stays the same.

interface Window {
  hits: number[];
}

const WINDOW_MS = 60_000; // 1 minute
const PER_KEY_MAX = 5; // max submissions per key (IP) per window
const GLOBAL_MAX = 100; // max submissions across all keys per window

const buckets = new Map<string, Window>();
let globalHits: number[] = [];

function prune(now: number, hits: number[]): number[] {
  const cutoff = now - WINDOW_MS;
  return hits.filter((t) => t > cutoff);
}

export interface RateLimitResult {
  ok: boolean;
  scope?: "per-key" | "global";
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and report whether it is within the per-key + global limits.
 * `now` is injectable for deterministic tests. When over a limit, NOTHING is recorded
 * for that limit (the hit is rejected), so a sustained burst stays capped.
 */
export function rateLimit(
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  // global ceiling first
  globalHits = prune(now, globalHits);
  if (globalHits.length >= GLOBAL_MAX) {
    return { ok: false, scope: "global", retryAfterSec: 60 };
  }
  // per-key window
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = prune(now, bucket.hits);
  if (bucket.hits.length >= PER_KEY_MAX) {
    buckets.set(key, bucket);
    return { ok: false, scope: "per-key", retryAfterSec: 60 };
  }
  // accept — record on both windows
  bucket.hits.push(now);
  buckets.set(key, bucket);
  globalHits.push(now);
  return { ok: true, retryAfterSec: 0 };
}

/** Test-only: clear all windows so a verify run starts from a clean limiter. */
export function __resetRateLimit(): void {
  buckets.clear();
  globalHits = [];
}

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS,
  PER_KEY_MAX,
  GLOBAL_MAX,
} as const;
