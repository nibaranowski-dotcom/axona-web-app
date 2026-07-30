"use server";

import { revalidatePath } from "next/cache";
import {
  dbForOrg,
  importEntity,
  IMPORT_ENTITIES,
  getCalibrationModel,
  type ImportResult,
} from "@axona/db";
import {
  proposeImportMapping,
  type ImportMappingProposal,
} from "@axona/agents";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// IO.1 — the shared import surface's server actions. The same propose → approve →
// audit shape PLM.2 already used, now generalized across the registered entities
// and with an optional MTX.1 AI-verify step. Every mutation is RBAC-gated on line
// 1 (imports mutate) and org-scoped; ONLY `confirmImportAction` writes, and it
// audits with the mapping model + calibrated confidence + approver.

const MAX_CSV_BYTES = 2_000_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function descriptorFor(entity: string): (typeof IMPORT_ENTITIES)[string] {
  const d = IMPORT_ENTITIES[entity];
  if (!d) throw new Error(`Unknown import entity "${entity}".`);
  return d;
}

function assertCsv(csv: string): void {
  if (typeof csv !== "string" || csv.trim().length === 0)
    throw new Error("Nothing to import — the file is empty.");
  if (csv.length > MAX_CSV_BYTES)
    throw new Error("That file is too large to import in one go.");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Dry-run preview — reports created/updated + every malformed row, WRITES NOTHING
 * and is never audited. An optional (human-approved) mapping remaps messy headers.
 */
export async function previewImportAction(
  entity: string,
  csv: string,
  mapping?: Record<string, string>,
): Promise<ImportResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]); // line 1 — before any DB call
  assertCsv(csv);
  const db = dbForOrg(user.orgId); // org-scoped — a tenant only ever writes its own
  return importEntity(
    db,
    descriptorFor(entity),
    { text: csv, mapping },
    { dryRun: true },
  );
}

/**
 * AI-verify (MTX.1) — an agent proposes a column→field mapping + flags suspect
 * rows, each with calibrated confidence (CONF.1). This is a PROPOSAL: it writes
 * nothing. The human reviews it, then confirms.
 */
export async function proposeMappingAction(
  entity: string,
  csv: string,
): Promise<ImportMappingProposal> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]);
  assertCsv(csv);
  const d = descriptorFor(entity);
  const calibration = await getCalibrationModel(user.orgId).catch(() => null);
  return proposeImportMapping(
    { text: csv },
    { entity: d.entity, required: d.required, optional: d.optional },
    { calibration },
  );
}

/**
 * Confirm — the human approves the (optionally AI-mapped) import. This is the
 * ONLY write path: valid rows commit atomically, then AUDIT.1 records what
 * changed with the mapping model + calibrated confidence (CONF.1) + approver.
 */
export async function confirmImportAction(
  entity: string,
  csv: string,
  approval?: {
    mapping?: Record<string, string>;
    model?: string;
    confidence?: number;
  },
): Promise<ImportResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]);
  assertCsv(csv);
  const d = descriptorFor(entity);
  const db = dbForOrg(user.orgId);
  const result = await importEntity(
    db,
    d,
    { text: csv, mapping: approval?.mapping },
    { dryRun: false },
  );

  const aiVerified = !!approval?.mapping;
  await writeAudit(db, {
    orgId: user.orgId,
    actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
    action: `${d.entity}.import`,
    target: { type: cap(d.entity), id: `csv:${result.totalRows}-rows` },
    summary: `Imported ${d.label} from spreadsheet — ${result.created} created · ${result.updated} updated · ${result.errors.length} rejected${
      aiVerified ? " (AI-verified mapping)" : ""
    }`,
    inputs: aiVerified ? { mapping: approval?.mapping } : undefined,
    output: {
      created: result.created,
      updated: result.updated,
      rejected: result.errors.length,
    },
    // AUDIT.3 + CONF.1 — an AI-verified import records the extraction model + the
    // proposal's calibrated confidence the human approved at.
    model: aiVerified ? approval?.model : undefined,
    confidence: aiVerified ? approval?.confidence : undefined,
    approver: { id: user.id, label: user.name || user.email },
  });
  revalidatePath("/import");
  return result;
}
