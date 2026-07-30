import type { OrgScopedDb } from "../client";
import type { Prisma, UnitStatus } from "@prisma/client";

// IO.1 — the universal spreadsheet-import core. This is `importUnits` (PLM.2)
// GENERALIZED, not a parallel importer: the machinery every import needs —
// parse · header-map · dry-run · row-level errors · created/updated split ·
// atomic write with NO partial corruption — lives here ONCE. A new entity is a
// tiny `EntityDescriptor` (columns · natural key · row validation · upsert); the
// core owns everything else. `importUnits`/`importBom` in ../plm/import.ts are
// now thin callers, their behavior byte-for-byte unchanged (verify:plm-2 green).
//
// /// MTX.1: the optional `mapping` lets an agent-proposed column→field map (from
// packages/agents/src/io/propose-mapping.ts, via extractColumn) drive a messy
// file — that mapping is a PROPOSAL a human approves; nothing here auto-writes.
// /// AUDIT.1 + CONF.1: the app layer audits the committed import with the mapping
// model + calibrated confidence + approver. This core never writes an audit — it
// is pure data, callable from a verify without a session.

export interface RowError {
  /** 1-based data row (header excluded); `0` = a file/header-level error. */
  row: number;
  /** IO.1: the source column the error is about, when row-specific to one field. */
  column?: string;
  message: string;
}

export interface ImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  errors: RowError[];
  totalRows: number;
}

/**
 * The ONE CSV parser for the whole platform (IO.1: no second parser is ever
 * introduced). Moved here from ../plm/import.ts; that file now imports it.
 * Comma-delimited, optional double-quotes, CRLF-tolerant. Headers lowercased.
 * (Seed/import fixtures are simple; a full RFC-4180 parser is not needed here.)
 */
export function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const headers = split(lines[0]!).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

/**
 * A per-entity descriptor — the ONLY per-entity code. Everything below the
 * `entity`/`label`/`required`/`optional` metadata is the same shape `importUnits`
 * already had, factored so the core can drive any entity identically.
 */
export interface EntityDescriptor<Ctx, Parsed> {
  /** registry key + AUDIT.1 target type, e.g. "unit" | "partMaster". */
  entity: string;
  /** human label for the shared import UI. */
  label: string;
  /** canonical required column names (lowercase). */
  required: string[];
  /** canonical optional column names (lowercase). */
  optional: string[];
  /** load shared lookup context once (FK resolution etc.) before row validation. */
  loadContext(db: OrgScopedDb): Promise<Ctx>;
  /**
   * Validate ONE row. Return the parsed record, or call `err(message[, column])`
   * and return `null` to reject it (exactly one error per rejected row, mirroring
   * `importUnits`' `return errors.push(...)`). `col(name)` reads a CANONICAL
   * column — the core resolves messy source headers via the optional mapping.
   */
  parseRow(a: {
    col: (name: string) => string;
    ctx: Ctx;
    row: number;
    err: (message: string, column?: string) => void;
  }): Parsed | null;
  /** the natural key of a parsed record (drives the created/updated split). */
  keyOf(v: Parsed): string;
  /** the set of natural keys already present among `valid` (dry-run safe). */
  existingKeys(db: OrgScopedDb, valid: Parsed[]): Promise<Set<string>>;
  /** the write op for one record; `exists` = its key was already present. */
  writeOp(
    db: OrgScopedDb,
    v: Parsed,
    exists: boolean,
  ): Prisma.PrismaPromise<unknown>;
}

export interface ImportSource {
  /** raw file text (CSV). */
  text: string;
  /**
   * Optional column mapping: canonicalField → source header (as it appears in
   * the file). Supplied by the AI-verify pass (MTX.1) after a human approves it.
   * Absent = the file is already clean (current `importUnits` behavior).
   */
  mapping?: Record<string, string>;
}

/**
 * The generalized import — same contract as `importUnits`:
 * `{ dryRun, created, updated, errors, totalRows }`; **dry-run defaults on** for
 * previews; **no partial writes** (all valid rows commit atomically or none do);
 * **idempotent** upsert by the entity's natural key; **org-scoped** via `db`.
 */
export async function importEntity<Ctx, Parsed>(
  db: OrgScopedDb,
  descriptor: EntityDescriptor<Ctx, Parsed>,
  source: ImportSource,
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const dryRun = opts.dryRun ?? false;
  const { headers, rows } = parseCsv(source.text);
  const errors: RowError[] = [];

  // mapping-aware header lookup: a canonical field resolves through the mapping
  // (when present) to the file's actual header, else to itself.
  const mapping = source.mapping;
  const indexOfField = (canonical: string): number => {
    const sourceHeader = mapping?.[canonical] ?? canonical;
    return headers.indexOf(sourceHeader.toLowerCase());
  };

  // required-column presence — same early-return + message as importUnits.
  for (const req of descriptor.required) {
    if (indexOfField(req) < 0)
      return {
        dryRun,
        created: 0,
        updated: 0,
        totalRows: rows.length,
        errors: [{ row: 0, message: `missing required column "${req}"` }],
      };
  }

  const ctx = await descriptor.loadContext(db);

  // validate EVERY row first (no partial corruption); errors collected in order.
  const valid: Parsed[] = [];
  rows.forEach((r, idx) => {
    const row = idx + 1;
    const col = (name: string) => {
      const i = indexOfField(name);
      return i >= 0 ? (r[i] ?? "") : "";
    };
    let rejected = false;
    const err = (message: string, column?: string) => {
      rejected = true;
      errors.push(column ? { row, column, message } : { row, message });
    };
    const parsed = descriptor.parseRow({ col, ctx, row, err });
    if (parsed !== null && !rejected) valid.push(parsed);
  });

  // determine created vs updated WITHOUT writing (dry-run reports the same split).
  const existing =
    valid.length > 0
      ? await descriptor.existingKeys(db, valid)
      : new Set<string>();
  let created = 0;
  let updated = 0;
  for (const v of valid)
    existing.has(descriptor.keyOf(v)) ? updated++ : created++;

  if (!dryRun && valid.length > 0) {
    // atomic — either all valid rows commit or none do.
    await db.$transaction(
      valid.map((v) =>
        descriptor.writeOp(db, v, existing.has(descriptor.keyOf(v))),
      ),
    );
  }

  return { dryRun, created, updated, errors, totalRows: rows.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registered entities — the proving pattern (Units + Parts). Each is a tiny
// descriptor; adding more is Phase 3.
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_STATUSES = new Set<string>([
  "in_build",
  "in_test",
  "deployed",
  "active",
  "decommissioned",
]);

interface UnitCtx {
  modelByCode: Map<string, string>;
}
interface ParsedUnit {
  serial: string;
  productModelId: string;
  status: UnitStatus;
  buildDate: Date | null;
  siteLabel: string | null;
  customerLabel: string | null;
}

/** Units by serial — the byte-for-byte logic that `importUnits` (PLM.2) had. */
export const unitDescriptor: EntityDescriptor<UnitCtx, ParsedUnit> = {
  entity: "unit",
  label: "Units",
  required: ["serial", "model", "status"],
  optional: ["builddate", "sitelabel", "customerlabel"],
  async loadContext(db) {
    const models = await db.productModel.findMany();
    return { modelByCode: new Map(models.map((m) => [m.code, m.id])) };
  },
  parseRow({ col, ctx, err }) {
    const serial = col("serial");
    const modelCode = col("model");
    const status = col("status");
    if (!serial) {
      err("empty serial");
      return null;
    }
    const productModelId = ctx.modelByCode.get(modelCode);
    if (!productModelId) {
      err(`unknown product model "${modelCode}"`);
      return null;
    }
    if (!UNIT_STATUSES.has(status)) {
      err(`invalid status "${status}"`);
      return null;
    }
    const buildRaw = col("builddate");
    const buildDate = buildRaw ? new Date(buildRaw) : null;
    if (buildRaw && Number.isNaN(buildDate!.getTime())) {
      err(`invalid buildDate "${buildRaw}"`);
      return null;
    }
    return {
      serial,
      productModelId,
      status: status as UnitStatus,
      buildDate,
      siteLabel: col("sitelabel") || null,
      customerLabel: col("customerlabel") || null,
    };
  },
  keyOf: (v) => v.serial,
  async existingKeys(db, valid) {
    const found = await db.unit.findMany({
      where: { serial: { in: valid.map((v) => v.serial) } },
      select: { serial: true },
    });
    return new Set(found.map((u) => u.serial));
  },
  writeOp(db, v) {
    return db.unit.upsert({
      where: { orgId_serial: { orgId: db.$org, serial: v.serial } },
      create: {
        orgId: db.$org,
        serial: v.serial,
        productModelId: v.productModelId,
        status: v.status,
        buildDate: v.buildDate,
        siteLabel: v.siteLabel,
        customerLabel: v.customerLabel,
      },
      update: {
        productModelId: v.productModelId,
        status: v.status,
        buildDate: v.buildDate,
        siteLabel: v.siteLabel,
        customerLabel: v.customerLabel,
      },
    });
  },
};

const LIFECYCLE_STATUSES = new Set<string>([
  "active",
  "ncr_hold",
  "superseded",
  "obsolete",
]);

interface ParsedPart {
  partNumber: string;
  description: string;
  category: string | null;
  lifecycleStatus: string;
}

/**
 * Parts — the master catalogue, idempotent by partNumber. The SECOND entity,
 * proving the core generalizes: a ~30-line descriptor, no new machinery.
 */
export const partMasterDescriptor: EntityDescriptor<null, ParsedPart> = {
  entity: "partMaster",
  label: "Parts",
  required: ["partnumber", "description", "lifecyclestatus"],
  optional: ["category"],
  async loadContext() {
    return null;
  },
  parseRow({ col, err }) {
    const partNumber = col("partnumber");
    if (!partNumber) {
      err("empty partNumber");
      return null;
    }
    const description = col("description");
    if (!description) {
      err("empty description");
      return null;
    }
    const lifecycleStatus = col("lifecyclestatus");
    if (!LIFECYCLE_STATUSES.has(lifecycleStatus)) {
      err(`invalid lifecycleStatus "${lifecycleStatus}"`);
      return null;
    }
    return {
      partNumber,
      description,
      category: col("category") || null,
      lifecycleStatus,
    };
  },
  keyOf: (v) => v.partNumber,
  async existingKeys(db, valid) {
    const found = await db.partMaster.findMany({
      where: { partNumber: { in: valid.map((v) => v.partNumber) } },
      select: { partNumber: true },
    });
    return new Set(found.map((p) => p.partNumber));
  },
  writeOp(db, v) {
    return db.partMaster.upsert({
      where: {
        orgId_partNumber: { orgId: db.$org, partNumber: v.partNumber },
      },
      create: {
        orgId: db.$org,
        partNumber: v.partNumber,
        description: v.description,
        category: v.category,
        lifecycleStatus: v.lifecycleStatus,
        approvedVendorIds: [],
      },
      update: {
        description: v.description,
        category: v.category,
        lifecycleStatus: v.lifecycleStatus,
      },
    });
  },
};

/** The import registry — the shared UI + actions enumerate this. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORT_ENTITIES: Record<string, EntityDescriptor<any, any>> = {
  unit: unitDescriptor,
  partMaster: partMasterDescriptor,
};

export type ImportEntityKey = keyof typeof IMPORT_ENTITIES;

/** Metadata for the shared UI (no descriptor internals leak to the client). */
export interface ImportEntityInfo {
  key: string;
  label: string;
  required: string[];
  optional: string[];
}

export function importEntityInfo(): ImportEntityInfo[] {
  return Object.entries(IMPORT_ENTITIES).map(([key, d]) => ({
    key,
    label: d.label,
    required: d.required,
    optional: d.optional,
  }));
}
