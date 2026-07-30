import {
  parseCsv,
  calibratedConfidence,
  type CalibrationModelData,
} from "@axona/db";
import { extractColumn } from "../matrix/extract";
import type { ModelClient } from "../runtime/model-client";

// IO.1 — the AI-verify pass for a messy import. Given a spreadsheet with unknown
// headers, an agent PROPOSES a column→field mapping and flags suspect rows, each
// with CALIBRATED confidence (CONF.1). This is a PROPOSAL a human approves in the
// dry-run preview — it NEVER writes. The write happens later through the same
// `importEntity` core once the human confirms (propose → approve → audit).
//
// The whole AI layer is built on MTX.1: it calls `extractColumn` (the ONE
// extraction primitive + model client) and `parseCsv` (the ONE parser). There is
// no new extraction path and no new model client here.

export interface FieldMapping {
  field: string;
  /** the resolved source header (as it appears in the file), or null if unmapped. */
  sourceHeader: string | null;
  required: boolean;
  /** calibrated confidence (CONF.1) when a calibration model is supplied, else raw. */
  confidence: number;
  rawConfidence: number;
  /** the verbatim span extractColumn grounded its answer in. */
  citation: string;
}

export interface FlaggedRow {
  row: number; // 1-based data row
  message: string;
  confidence: number;
}

export interface ImportMappingProposal {
  entity: string;
  /** field → source header, RESOLVED entries only (the map `importEntity` consumes). */
  mapping: Record<string, string>;
  fields: FieldMapping[];
  flaggedRows: FlaggedRow[];
  /** overall calibrated confidence — the weakest required-field mapping. */
  confidence: number;
  /** the extraction model id (matches getExtractionModel's branch). */
  model: string;
  /** the file's actual headers (for the review UI). */
  headers: string[];
}

const FLAG_THRESHOLD = 0.5;
const MAX_FLAG_SCAN = 100;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Resolve the model's suggested header text to a REAL file header. This is
// header normalization (string matching) — NOT extraction: the semantic answer +
// calibrated confidence come from extractColumn (MTX.1). Falls back to a
// normalized field↔header containment match so a clean file still maps offline.
function resolveHeader(
  suggested: string,
  headers: string[],
  field: string,
): string | null {
  const ns = norm(suggested);
  if (ns) {
    const bySuggest = headers.find((h) => norm(h) === ns);
    if (bySuggest) return bySuggest;
  }
  const nf = norm(field);
  return (
    headers.find((h) => {
      const nh = norm(h);
      return nh === nf || nh.includes(nf) || nf.includes(nh);
    }) ?? null
  );
}

export async function proposeImportMapping(
  source: { text: string },
  descriptor: { entity: string; required: string[]; optional: string[] },
  opts?: { model?: ModelClient; calibration?: CalibrationModelData | null },
): Promise<ImportMappingProposal> {
  const { headers, rows } = parseCsv(source.text);
  const wanted = [
    ...descriptor.required.map((f) => ({ field: f, required: true })),
    ...descriptor.optional.map((f) => ({ field: f, required: false })),
  ];

  // The file's real headers + up to 3 sample rows are the extraction document —
  // the same shape MTX.1 feeds extractColumn from File.text.
  const sample = rows
    .slice(0, 3)
    .map((r) => r.join(" | "))
    .join("\n");
  const doc = `HEADERS: ${headers.join(" | ")}\n${sample}`;

  const fields: FieldMapping[] = [];
  const mapping: Record<string, string> = {};

  for (const { field, required } of wanted) {
    const ans = await extractColumn(
      doc,
      `Which column header in this spreadsheet maps to the field "${field}"? Answer with the exact header text.`,
      opts,
    );
    const resolved = resolveHeader(ans.value, headers, field);
    if (resolved) mapping[field] = resolved;
    const cal = calibratedConfidence(ans.confidence, opts?.calibration ?? null);
    fields.push({
      field,
      sourceHeader: resolved,
      required,
      rawConfidence: ans.confidence,
      confidence: cal.value,
      citation: ans.citation,
    });
  }

  // Flag suspect rows: extractColumn scores each row's internal consistency; a
  // low calibrated confidence flags it for human review before import (CONF.1).
  const flaggedRows: FlaggedRow[] = [];
  const scan = rows.slice(0, MAX_FLAG_SCAN);
  for (let i = 0; i < scan.length; i++) {
    const rowText = headers
      .map((h, k) => `${h}: ${scan[i]![k] ?? ""}`)
      .join(" · ");
    const ans = await extractColumn(
      rowText,
      `Does this ${descriptor.entity} row look internally consistent and complete?`,
      opts,
    );
    const cal = calibratedConfidence(ans.confidence, opts?.calibration ?? null);
    if (cal.value < FLAG_THRESHOLD)
      flaggedRows.push({
        row: i + 1,
        message: "low extraction confidence — review before import",
        confidence: Math.round(cal.value * 100) / 100,
      });
  }

  // Overall confidence = the weakest REQUIRED field mapping (one missing required
  // column tanks the import). Unmapped required field ⇒ 0.
  const req = fields.filter((f) => f.required);
  const overall = req.length
    ? Math.min(...req.map((f) => (f.sourceHeader ? f.confidence : 0)))
    : 0;

  return {
    entity: descriptor.entity,
    mapping,
    fields,
    flaggedRows,
    confidence: Math.round(overall * 100) / 100,
    model: process.env.ANTHROPIC_API_KEY ? "claude" : "fake-extract",
    headers,
  };
}
