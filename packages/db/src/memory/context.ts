import type { OrgScopedDb } from "../client";
import type { Embedder } from "../embed/embedder";
import {
  calibratedConfidence,
  getCalibrationModel,
} from "../confidence/calibration";
import { recallMemory, type EntityType, type MemoryHit } from "./recall";

// MEM.2 — context assembly. Turns MEM.1's retrieval into retrieval-AUGMENTATION:
// for the current situation (the subject entity in play + the question), assemble
// the most relevant PRIOR episodes, calibrate each one's confidence (CONF.1),
// PRUNE to a hard token budget (relevance beats volume — keep the highest-scoring,
// drop the rest), and return a formatted CITED block + the hit provenance the agent
// can quote. Below the memory-confidence floor / cold-start / no subject → inject
// NOTHING (honest — never fabricate a memory). Org-scoped by the `dbForOrg` client,
// so a second org gets zero of the first's memory (per-tenant isolation invariant).
//
// This changes nothing about the memory STORE (MEM.1) or the calibration map
// (CONF.1) — it is retrieval → context only. Memory INFORMS; the agent still
// proposes→approve→audit.

/** Hard cap on the injected block (≈ a handful of episodes). Coordinated with
 *  RUNTIME.1's transcript pruning: the block lands in the system prompt, this
 *  budget is its reserved share, so injection never blows the context window. */
export const MEMORY_TOKEN_BUDGET = 900;
/** Below this CONF.1-calibrated confidence, an episode is not injected. */
export const MEMORY_CONFIDENCE_FLOOR = 0.2;
const CHARS_PER_TOKEN = 4; // documented rough token estimate

export interface AssembleContextInput {
  /** Informational — the db is already org-scoped; kept for a legible call site. */
  orgId?: string;
  /** The entity in play (a human code like "NCR-118" or a cuid). */
  subject?: { type: EntityType; id: string };
  /** The user's question / situation text (drives the vector arm + precedent cue). */
  query?: string;
  moduleScope?: string;
  /** Hard token cap on the assembled block (default MEMORY_TOKEN_BUDGET). */
  tokenBudget?: number;
  /** Override the confidence floor (tests). */
  floor?: number;
  limit?: number;
  embedder?: Embedder;
}

export interface AssembledHit {
  summary: string;
  kind: string;
  outcome: string | null;
  subjectCode: string | null;
  /** CONF.1-calibrated confidence (from the hit's hybrid score). */
  confidence: number;
  calibratedState: "calibrated" | "uncalibrated";
  provenance: { sourceType: string; sourceId: string };
  via: MemoryHit["via"];
}

export type AssembleReason =
  | "injected"
  | "no-subject"
  | "cold-start"
  | "below-floor";

export interface AssembledMemory {
  /** The formatted, cited block to inject — "" when nothing is injected. */
  block: string;
  injected: number;
  /** Provenance of the injected episodes (for the trace + audit). */
  hits: AssembledHit[];
  top: AssembledHit | null;
  reason: AssembleReason;
  tokensUsed: number;
  budget: number;
}

const estTokens = (s: string) => Math.ceil(s.length / CHARS_PER_TOKEN);

/** One cited line: "1. RESOLUTION CONTAINED — <summary> · conf 0.71 [NCR:<id>] · NCR-114". */
function citeLine(h: AssembledHit, i: number): string {
  const out = h.outcome ? ` ${h.outcome.toUpperCase()}` : "";
  const conf = `conf ${h.confidence.toFixed(2)}${
    h.calibratedState === "uncalibrated" ? " (uncal)" : ""
  }`;
  const cite = `[${h.provenance.sourceType}:${h.provenance.sourceId}]`;
  const anchor = h.subjectCode ? ` · ${h.subjectCode}` : "";
  return `${i + 1}. ${h.kind}${out} — ${h.summary} · ${conf} ${cite}${anchor}`;
}

const HEADER =
  "RELEVANT PRIOR EPISODES (operational memory — cite these by their [source] tag; they INFORM, they do not decide):";

const emptyResult = (
  reason: AssembleReason,
  budget: number,
): AssembledMemory => ({
  block: "",
  injected: 0,
  hits: [],
  top: null,
  reason,
  tokensUsed: 0,
  budget,
});

/**
 * Assemble the injectable operational-memory block for the current situation.
 * Read-only; org-scoped by `db`. Returns an empty block (never a fabricated one)
 * on no-subject / cold-start / below-floor, with the `reason` for the trace.
 */
export async function assembleContext(
  db: OrgScopedDb,
  input: AssembleContextInput,
): Promise<AssembledMemory> {
  const budget = input.tokenBudget ?? MEMORY_TOKEN_BUDGET;
  const floor = input.floor ?? MEMORY_CONFIDENCE_FLOOR;

  if (!input.subject && !input.query) return emptyResult("no-subject", budget);

  // MEM.1 — hybrid recall over the ORG's memory only (isolation via db scope).
  const raw = await recallMemory(db, {
    query: input.query,
    subjectType: input.subject?.type,
    subjectId: input.subject?.id,
    limit: input.limit ?? 8,
    embedder: input.embedder,
  });
  if (raw.length === 0) return emptyResult("cold-start", budget);

  // Inject PRECEDENT — prior episodes about RELATED subjects, not the current
  // subject's own state (the agent already has that; it's what's being asked about).
  // So drop hits anchored to the query subject itself; keep the neighborhood.
  const selfCode = input.subject?.id.toUpperCase();
  const precedent = selfCode
    ? raw.filter((h) => (h.subject?.code ?? "").toUpperCase() !== selfCode)
    : raw;
  if (precedent.length === 0) return emptyResult("cold-start", budget);

  // CONF.1 — calibrate each hit's ranking score into a confidence (org's map).
  const model = await getCalibrationModel(db.$org);
  const scored: AssembledHit[] = precedent.map((h) => {
    const cal = calibratedConfidence(h.score, model);
    return {
      summary: h.summary,
      kind: h.kind,
      outcome: h.outcome,
      subjectCode: h.subject?.code ?? null,
      confidence: cal.value,
      calibratedState: cal.state,
      provenance: h.provenance,
      via: h.via,
    };
  });

  // Confidence-gate, then rank (highest confidence first) for budget pruning.
  const passing = scored
    .filter((h) => h.confidence >= floor)
    .sort((a, b) => b.confidence - a.confidence);
  if (passing.length === 0) return emptyResult("below-floor", budget);

  // Prune to the token budget: keep the highest-scoring, drop the rest. Always
  // inject at least the single top episode (even if it alone edges the budget).
  const kept: AssembledHit[] = [];
  let body = HEADER;
  for (const h of passing) {
    const candidate = `${body}\n${citeLine(h, kept.length)}`;
    if (estTokens(candidate) > budget) {
      if (kept.length === 0) {
        body = candidate;
        kept.push(h);
      }
      break;
    }
    body = candidate;
    kept.push(h);
  }

  return {
    block: body,
    injected: kept.length,
    hits: kept,
    top: kept[0] ?? null,
    reason: "injected",
    tokensUsed: estTokens(body),
    budget,
  };
}
