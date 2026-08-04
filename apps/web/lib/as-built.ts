import { leafOnly, dbForOrg, asBuiltDiff } from "@axona/db";
import {
  buildAgentProposal,
  type AgentProposal,
  type AgentSignal,
} from "./agent-proposal";

// PLM.4 — the as-built diff read model. Answers Q1: "the same robot is not
// actually the same." Aligns the as-designed BOM to the captured AsBuiltRecords
// BY POSITION, so every position appears exactly once whether it matched, was
// substituted, was never installed, or was installed off-BOM.
//
// Substitutions are the NORMAL case. They render as a flagged difference in INK —
// never red, never an error state. A rev bump mid-build and an approved alternate
// are healthy manufacturing, not failures.

export type DiffFlag =
  | "match"
  | "flagged-lot"
  | "rev-bump"
  | "alt-source"
  | "not-installed"
  | "off-bom";

export interface AsBuiltRow {
  position: string;
  designed: { partNumber: string; rev: string; description: string } | null;
  built: { partNumber: string; rev: string; description: string } | null;
  lotCode: string | null;
  componentSerial: string | null;
  isSubstitution: boolean;
  flag: DiffFlag;
  /** Short label for the flag column ("Flagged lot", "Rev bump", …). */
  flagLabel: string;
  /** The captured "why" — never invented; null when nothing was recorded. */
  reason: string | null;
  installedBy: string | null;
  installedAt: Date | null;
  /** Is this lot quarantined elsewhere in the system (a real cross-check)? */
  lotQuarantined: boolean;
}

export interface AsBuiltView {
  serial: string;
  modelCode: string;
  modelName: string;
  designRevision: string;
  rows: AsBuiltRow[];
  summary: {
    positions: number;
    substitutions: number;
    lots: number;
    matching: number;
  };
  /**
   * DEMO.6 #2 — the genealogy agent FLAGGING the drift, rather than the screen
   * rendering a passive diff and leaving the reader to spot it. Null when the
   * as-built matches the design: a clean unit gets no finding, because a
   * zero-evidence "proposal" is noise dressed as intelligence.
   */
  agent: AgentProposal | null;
}

/** Classify HOW a position diverged — the design's "Substitution" column. */
function classify(
  designed: { partNumber: string; rev: string } | null,
  built: { partNumber: string; rev: string } | null,
  isSubstitution: boolean,
  lotQuarantined: boolean,
): { flag: DiffFlag; flagLabel: string } {
  if (!built) return { flag: "not-installed", flagLabel: "Not installed" };
  if (!designed) return { flag: "off-bom", flagLabel: "Off BOM" };
  if (!isSubstitution) return { flag: "match", flagLabel: "Match" };
  // A lot on quality hold is the most consequential divergence — it outranks a
  // revision difference even when both are true, because it is the one that
  // propagates (NCR → ECO → affected units). Report the fact that matters.
  if (lotQuarantined) return { flag: "flagged-lot", flagLabel: "Flagged lot" };
  if (designed.partNumber !== built.partNumber)
    return { flag: "alt-source", flagLabel: "Alt part" };
  if (designed.rev !== built.rev)
    return { flag: "rev-bump", flagLabel: "Rev bump" };
  // Same part, same revision, still flagged → an approved alternate source
  // recorded against the same revision.
  return { flag: "alt-source", flagLabel: "Alt source" };
}

export async function getAsBuiltView(
  orgId: string,
  serial: string,
): Promise<AsBuiltView | null> {
  const db = dbForOrg(orgId);
  const unit = await db.unit.findFirst({
    where: { serial },
    include: { productModel: true },
  });
  if (!unit) return null;

  const [diff, records, bomAll] = await Promise.all([
    asBuiltDiff(db, unit.id),
    db.asBuiltRecord.findMany({
      where: { unitId: unit.id },
      include: { partRevision: { include: { partMaster: true } } },
    }),
    // PLM.13: the model's CURRENT design revision, leaves only. Querying by
    // productModelId alone was correct while one revision existed; with a
    // revision ladder it unions all of them, and assemblies are not installable.
    db.bomLine.findMany({
      where: {
        productModelId: unit.productModelId,
        designRevision: unit.productModel.designRevision,
      },
      include: { partRevision: { include: { partMaster: true } } },
    }),
  ]);
  const bom = leafOnly(bomAll);

  // Which of these lots is flagged? A REAL cross-check, not a hardcoded lot
  // number: the part master this lot was built from is on NCR hold / quarantined
  // by Quality. When the hold is lifted the flag disappears on its own.
  const lotCodes = [
    ...new Set(records.map((r) => r.lotCode).filter((c): c is string => !!c)),
  ];
  const quarantined = new Set<string>();
  for (const r of records) {
    if (
      r.lotCode &&
      /ncr_hold|quarantin/i.test(r.partRevision.partMaster.lifecycleStatus)
    )
      quarantined.add(r.lotCode);
  }

  const recByPos = new Map(records.map((r) => [r.bomPosition, r]));
  const bomByPos = new Map(bom.map((b) => [b.position, b]));

  // Resolve installer names once (installedById is a scalar user id).
  const installerIds = [
    ...new Set(
      records.map((r) => r.installedById).filter((i): i is string => !!i),
    ),
  ];
  const installers = installerIds.length
    ? await db.user.findMany({ where: { id: { in: installerIds } } })
    : [];
  const nameById = new Map(installers.map((u) => [u.id, u.name ?? u.email]));

  const rows: AsBuiltRow[] = diff.lines.map((l) => {
    const rec = recByPos.get(l.position);
    const bomLine = bomByPos.get(l.position);
    const lotQuarantined =
      !!l.actual?.lotCode && quarantined.has(l.actual.lotCode);
    const { flag, flagLabel } = classify(
      l.expected,
      l.actual,
      l.isSubstitution,
      lotQuarantined,
    );
    return {
      position: l.position,
      designed: l.expected
        ? {
            partNumber: l.expected.partNumber,
            rev: l.expected.rev,
            description: bomLine?.partRevision.partMaster.description ?? "",
          }
        : null,
      built: l.actual
        ? {
            partNumber: l.actual.partNumber,
            rev: l.actual.rev,
            description: rec?.partRevision.partMaster.description ?? "",
          }
        : null,
      lotCode: l.actual?.lotCode ?? null,
      componentSerial: rec?.componentSerial ?? null,
      isSubstitution: l.isSubstitution,
      flag,
      flagLabel,
      reason: rec?.note ?? null,
      installedBy: rec?.installedById
        ? (nameById.get(rec.installedById) ?? null)
        : null,
      installedAt: rec?.installedAt ?? null,
      lotQuarantined,
    };
  });

  // ── DEMO.6 #2 — the genealogy agent's drift flag ────────────────────────────
  // Every signal is a row already on this screen; the agent is not seeing anything
  // the reader could not, it is doing the noticing. A quarantined lot weighs most
  // because it is the one deviation with fleet-wide consequences — the same
  // COMPUTE-720 / lot-88471 substitution the RCA thread traces, so the two screens
  // tell one story rather than two.
  const subRows = rows.filter((r) => r.isSubstitution);
  // `quarantined` above is the Set of lot CODES; these are the ROWS carrying one.
  const quarantinedRows = subRows.filter((r) => r.lotQuarantined);
  const uncaptured = subRows.filter((r) => !r.reason);
  const signals: AgentSignal[] = [];
  if (subRows.length > 0)
    signals.push({
      key: "substituted-positions",
      detail: `${subRows.length} of ${diff.summary.positions} positions differ from the as-designed BOM`,
      weight: Math.min(0.4, 0.2 * subRows.length),
    });
  if (quarantinedRows.length > 0)
    signals.push({
      key: "quarantined-lot",
      detail: `${quarantinedRows[0]!.built?.partNumber ?? "a part"} came from quarantined lot ${quarantinedRows[0]!.lotCode}`,
      weight: 0.35,
    });
  if (uncaptured.length > 0)
    signals.push({
      key: "no-recorded-reason",
      detail: `${uncaptured.length} substitution(s) carry no recorded reason`,
      weight: Math.min(0.2, 0.1 * uncaptured.length),
    });
  if (lotCodes.length > 0)
    signals.push({
      key: "lot-traceability",
      detail: `${lotCodes.length} lot code(s) captured at build — traceable`,
      weight: 0.08,
    });

  const agent = await buildAgentProposal(orgId, {
    text:
      quarantinedRows.length > 0
        ? `${quarantinedRows[0]!.built?.partNumber ?? "A part"} at ${quarantinedRows[0]!.position} was built from quarantined lot ${quarantinedRows[0]!.lotCode} instead of the as-designed revision.`
        : `${subRows.length} position(s) deviate from the as-designed BOM.`,
    action:
      quarantinedRows.length > 0
        ? "Acknowledge the drift and trace the lot to every unit that carries it"
        : "Acknowledge the drift and record a reason against each substitution",
    signals,
  });

  return {
    serial: unit.serial,
    modelCode: unit.productModel.code,
    modelName: unit.productModel.name,
    designRevision: unit.productModel.designRevision,
    rows,
    summary: {
      positions: diff.summary.positions,
      substitutions: diff.summary.substitutions,
      lots: lotCodes.length,
      matching: diff.summary.positions - diff.summary.substitutions,
    },
    agent,
  };
}
