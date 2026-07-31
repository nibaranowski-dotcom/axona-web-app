import * as XLSX from "xlsx";
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
  /** IO.2 — rows matched by natural key whose columns were unchanged (upsert mode
   *  only; 0 in the default create/blind-update mode). Never silently overwritten. */
  skipped: number;
  errors: RowError[];
  totalRows: number;
}

/** IO.2 — one exported row: its natural key (matching `keyOf`) + the column cells in
 *  the descriptor's `columns` order. Round-trips back through `importEntity`. */
export interface ExportRow {
  key: string;
  cells: (string | number)[];
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
 * MFX.1 — xlsx → rows, the SAME `{ headers, rows }` shape parseCsv returns, so an
 * Excel workbook feeds the identical `importEntity` path (NOT a parallel importer;
 * just a second front-end). The first sheet's first row is the header (lowercased,
 * trimmed); every cell is coerced to a trimmed string. Parsed SERVER-SIDE from the
 * raw bytes — the single `xlsx` dependency, no client parsing.
 */
export function parseWorkbook(bytes: Uint8Array): {
  headers: string[];
  rows: string[][];
} {
  const wb = XLSX.read(bytes, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) return { headers: [], rows: [] };
  const sheet = wb.Sheets[first]!;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (grid.length === 0) return { headers: [], rows: [] };
  const cell = (v: unknown) => (v == null ? "" : String(v).trim());
  const headers = (grid[0] as unknown[]).map((h) => cell(h).toLowerCase());
  const rows = grid.slice(1).map((r) => (r as unknown[]).map(cell));
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
  // IO.2 — export / round-trip / upsert-skip support (optional; the core entities
  // implement it, so importEntity's default path is untouched for callers that don't).
  // `columns` is the export header order (⊆ required ∪ optional); `readRows` reads ALL
  // org rows serialized to those columns, keyed by the SAME natural key `keyOf`
  // produces — so an export round-trips and upsert-mode can compare cells for a skip.
  columns?: string[];
  readRows?(db: OrgScopedDb): Promise<ExportRow[]>;
}

export interface ImportSource {
  /** raw file text (CSV). Optional when `bytes` (xlsx) is supplied instead. */
  text?: string;
  /**
   * MFX.1 — raw xlsx bytes. When present, parsed via `parseWorkbook` into the same
   * rows `text` would; everything downstream (mapping · validation · upsert) is
   * identical. Exactly one of `text`/`bytes` is used (bytes wins).
   */
  bytes?: Uint8Array;
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
  // IO.2 — `mode: "upsert"` is OPT-IN bulk-update: match by natural key, UPDATE only
  // CHANGED rows, CREATE new, SKIP unchanged (never a silent overwrite). Absent =>
  // the default create/blind-update path is byte-identical for existing callers.
  opts: { dryRun?: boolean; mode?: "upsert" } = {},
): Promise<ImportResult> {
  const dryRun = opts.dryRun ?? false;
  // MFX.1 — CSV and xlsx converge to the same rows here; the descriptor never
  // knows which front-end produced them.
  const { headers, rows } = source.bytes
    ? parseWorkbook(source.bytes)
    : parseCsv(source.text ?? "");
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
        skipped: 0,
        totalRows: rows.length,
        errors: [{ row: 0, message: `missing required column "${req}"` }],
      };
  }

  const ctx = await descriptor.loadContext(db);
  const upsert = opts.mode === "upsert" && !!descriptor.columns;

  // validate EVERY row first (no partial corruption); errors collected in order.
  const valid: Parsed[] = [];
  // IO.2 upsert — the incoming canonical cells per valid row, to compare vs the
  // existing serialized row (unchanged ⇒ skip). Only captured in upsert mode.
  const validCells: string[][] = [];
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
    if (parsed !== null && !rejected) {
      valid.push(parsed);
      if (upsert)
        validCells.push(descriptor.columns!.map((c) => String(col(c)).trim()));
    }
  });

  // ── IO.2 bulk-update (upsert) — CREATE new · UPDATE changed · SKIP unchanged ──
  if (upsert && descriptor.readRows) {
    const existingRows = await descriptor.readRows(db);
    const cellsByKey = new Map(
      existingRows.map((e) => [e.key, e.cells.map((c) => String(c).trim())]),
    );
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    valid.forEach((v, i) => {
      const ex = cellsByKey.get(descriptor.keyOf(v));
      if (!ex) {
        created++;
        ops.push(descriptor.writeOp(db, v, false));
        return;
      }
      const inc = validCells[i] ?? [];
      const same = inc.length === ex.length && inc.every((c, j) => c === ex[j]);
      if (same) skipped++;
      else {
        updated++;
        ops.push(descriptor.writeOp(db, v, true));
      }
    });
    if (!dryRun && ops.length > 0) await db.$transaction(ops);
    return {
      dryRun,
      created,
      updated,
      skipped,
      errors,
      totalRows: rows.length,
    };
  }

  // ── default path (create + idempotent blind-update; unchanged for all callers) ──
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

  return {
    dryRun,
    created,
    updated,
    skipped: 0,
    errors,
    totalRows: rows.length,
  };
}

/**
 * IO.2 — the export counterpart to `importEntity`, reusing the SAME descriptor. Reads
 * all org rows via `descriptor.readRows` and returns them in `descriptor.columns`
 * order, so exporting an entity → re-importing the file is a round-trip no-op (the
 * cells match, upsert mode reports every row skipped). Org-scoped via `db`.
 */
export async function exportEntity<Ctx, Parsed>(
  db: OrgScopedDb,
  descriptor: EntityDescriptor<Ctx, Parsed>,
): Promise<{ headers: string[]; rows: (string | number)[][] }> {
  if (!descriptor.columns || !descriptor.readRows)
    throw new Error(`entity "${descriptor.entity}" is not exportable`);
  const rows = await descriptor.readRows(db);
  return { headers: descriptor.columns, rows: rows.map((r) => r.cells) };
}

/**
 * IO.2 — the `parseWorkbook` counterpart: write a header + rows to xlsx bytes using
 * the SAME single `xlsx` dependency (no second writer). Round-trips with parseWorkbook.
 */
export function writeWorkbook(
  headers: string[],
  rows: (string | number)[][],
): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

/** IO.2 — the `parseCsv` counterpart. RFC-4180 quoting for cells with `,`/`"`/newline. */
export function writeCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
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
  // IO.2 — export in the SAME canonical columns import reads. buildDate is full ISO
  // so an export round-trips with no precision drift (re-import → identical instant).
  columns: [
    "serial",
    "model",
    "status",
    "builddate",
    "sitelabel",
    "customerlabel",
  ],
  async readRows(db) {
    const units = await db.unit.findMany({
      include: { productModel: { select: { code: true } } },
    });
    return units.map((u) => ({
      key: u.serial,
      cells: [
        u.serial,
        u.productModel.code,
        u.status,
        u.buildDate ? u.buildDate.toISOString() : "",
        u.siteLabel ?? "",
        u.customerLabel ?? "",
      ],
    }));
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
  // IO.2 — export/round-trip columns (import updates these 3 fields; approvedVendorIds
  // is preserved on update, so a round-trip never drifts it).
  columns: ["partnumber", "description", "lifecyclestatus", "category"],
  async readRows(db) {
    const pms = await db.partMaster.findMany();
    return pms.map((p) => ({
      key: p.partNumber,
      cells: [p.partNumber, p.description, p.lifecycleStatus, p.category ?? ""],
    }));
  },
};

interface BomCtx {
  modelByCode: Map<string, string>;
  revByKey: Map<string, string>; // "partNumber|rev" → partRevisionId
}
interface ParsedBomLine {
  productModelId: string;
  designRevision: string;
  position: string;
  partRevisionId: string;
  qty: number;
}

/**
 * MFX.1 — as-designed BOM lines, the THIRD entity. Same validation `importBom` had
 * (model · revision · position · partnumber · rev · qty), factored as a descriptor
 * so an Excel/CSV BOM flows through the one IO.1 core (dry-run · row errors · atomic
 * upsert). Idempotent by (model · design revision · position) — the additive unique.
 */
export const bomLineDescriptor: EntityDescriptor<BomCtx, ParsedBomLine> = {
  entity: "bomLine",
  label: "BOM lines",
  required: ["model", "revision", "position", "partnumber", "rev", "qty"],
  optional: [],
  async loadContext(db) {
    const models = await db.productModel.findMany();
    const partMasters = await db.partMaster.findMany({
      include: { revisions: true },
    });
    const revByKey = new Map<string, string>();
    for (const pm of partMasters)
      for (const rev of pm.revisions)
        revByKey.set(`${pm.partNumber}|${rev.rev}`, rev.id);
    return {
      modelByCode: new Map(models.map((m) => [m.code, m.id])),
      revByKey,
    };
  },
  parseRow({ col, ctx, err }) {
    const productModelId = ctx.modelByCode.get(col("model"));
    if (!productModelId) {
      err(`unknown product model "${col("model")}"`);
      return null;
    }
    const position = col("position");
    if (!position) {
      err("empty position");
      return null;
    }
    const partRevisionId = ctx.revByKey.get(
      `${col("partnumber")}|${col("rev")}`,
    );
    if (!partRevisionId) {
      err(`unknown part revision "${col("partnumber")} ${col("rev")}"`);
      return null;
    }
    const qty = Number(col("qty"));
    if (!Number.isInteger(qty) || qty <= 0) {
      err(`invalid qty "${col("qty")}"`);
      return null;
    }
    return {
      productModelId,
      designRevision: col("revision"),
      position,
      partRevisionId,
      qty,
    };
  },
  keyOf: (v) => `${v.productModelId}|${v.designRevision}|${v.position}`,
  async existingKeys(db, valid) {
    const found = await db.bomLine.findMany({
      where: { productModelId: { in: valid.map((v) => v.productModelId) } },
      select: { productModelId: true, designRevision: true, position: true },
    });
    return new Set(
      found.map((l) => `${l.productModelId}|${l.designRevision}|${l.position}`),
    );
  },
  writeOp(db, v) {
    return db.bomLine.upsert({
      where: {
        orgId_productModelId_designRevision_position: {
          orgId: db.$org,
          productModelId: v.productModelId,
          designRevision: v.designRevision,
          position: v.position,
        },
      },
      create: {
        orgId: db.$org,
        productModelId: v.productModelId,
        designRevision: v.designRevision,
        position: v.position,
        partRevisionId: v.partRevisionId,
        qty: v.qty,
      },
      update: { partRevisionId: v.partRevisionId, qty: v.qty },
    });
  },
  // IO.2 — export in the same canonical BOM columns. key uses the internal
  // productModelId (== keyOf) while the "model" cell is the human code.
  columns: ["model", "revision", "position", "partnumber", "rev", "qty"],
  async readRows(db) {
    const lines = await db.bomLine.findMany({
      include: {
        productModel: { select: { code: true } },
        partRevision: {
          include: { partMaster: { select: { partNumber: true } } },
        },
      },
    });
    return lines.map((b) => ({
      key: `${b.productModelId}|${b.designRevision}|${b.position}`,
      cells: [
        b.productModel.code,
        b.designRevision,
        b.position,
        b.partRevision.partMaster.partNumber,
        b.partRevision.rev,
        b.qty,
      ],
    }));
  },
};

/** The import registry — the shared UI + actions enumerate this. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORT_ENTITIES: Record<string, EntityDescriptor<any, any>> = {
  unit: unitDescriptor,
  partMaster: partMasterDescriptor,
  bomLine: bomLineDescriptor,
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
