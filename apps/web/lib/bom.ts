/**
 * PLM.13 — the BOM (as-designed) read model for `/bom/:model`.
 *
 * The as-designed side of "as-designed vs as-built": the multi-level tree a
 * product model resolves to AT A CHOSEN DESIGN REVISION, plus the ladder of
 * revisions that produced it. Everything here is DERIVED from data that already
 * exists — `BomLine` (tree + revision), `PartRevision` (rev · effectivity ·
 * originating ECO), `PartMaster` (lifecycle) and `ECO` (effectivity serial/date).
 * Nothing about a revision is stored as prose: "what changed" is the diff between
 * two revisions of the tree, and the driving ECO is the one recorded on the part
 * revisions that revision introduced.
 */
import { dbForOrg, getBomTree, flattenTree, entityRoute } from "@axona/db";
import type { BomNode } from "@axona/db";

export interface BomTreeLine {
  position: string;
  name: string;
  partNumber: string;
  rev: string;
  qty: number;
  /** "SN-2190+" — from the ECO that introduced this part revision, when there is one. */
  effectivity: string;
  depth: number;
  isAssembly: boolean;
  /** SUPERSEDING / ON HOLD — a lifecycle flag worth showing on the line. */
  flag: string | null;
  /** LINK.1 — where this line's part lives (Inventory). */
  href: string;
  children: BomTreeLine[];
}

export interface BomRevision {
  rev: string;
  isCurrent: boolean;
  /** Derived: what this revision changed vs the one before it. */
  change: string;
  /** The ECO recorded on the part revisions this revision introduced. */
  ecoCode: string | null;
  ecoHref: string | null;
  /** "From SN-2190" / "SN-2172–2189" — from the driving ECO's effectivity. */
  effect: string;
  date: string | null;
}

export interface BomPartDetail {
  position: string;
  name: string;
  partNumber: string;
  rev: string;
  qty: number;
  refDes: string;
  lifecycleStatus: string;
  approved: boolean;
  effectivity: string;
  supersededBy: string | null;
  inventoryHref: string;
  ecoCode: string | null;
  ecoHref: string | null;
}

export interface BomView {
  modelCode: string;
  modelName: string;
  currentRev: string;
  selectedRev: string;
  revisions: BomRevision[];
  tree: BomTreeLine[];
  positions: number;
  assemblies: number;
  /** The selected revision's own effectivity band. */
  effectivity: {
    serial: string | null;
    date: string | null;
    ecoCode: string | null;
    ecoHref: string | null;
  };
  /** The expanded per-part detail, when a position is selected. */
  part: BomPartDetail | null;
  /** True when this model has no BOM at all — the import-first empty state. */
  empty: boolean;
}

/** "2026-06-18" — dates render mono + specific, never relative, on this screen. */
function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * The ECO effectivity serial reads as a lower bound on the line ("SN-2190+")
 * because a design revision applies FROM a serial onward.
 */
function effLabel(serial: string | null | undefined): string {
  return serial ? `${serial}+` : "—";
}

export async function getBomView(
  orgId: string,
  modelCode: string,
  opts: { rev?: string; position?: string } = {},
): Promise<BomView | null> {
  const db = dbForOrg(orgId);
  const model = await db.productModel.findFirst({
    where: { code: modelCode },
    select: { id: true, code: true, name: true, designRevision: true },
  });
  if (!model) return null;

  // The revision ladder is the set of revisions the BOM actually HAS — not a
  // stored list. `groupBy` keeps it one query however many lines there are.
  const revRows = await db.bomLine.groupBy({
    by: ["designRevision"],
    where: { productModelId: model.id },
    _count: { _all: true },
  });
  const revs = revRows.map((r) => r.designRevision).sort();
  if (revs.length === 0) {
    return {
      modelCode: model.code,
      modelName: model.name,
      currentRev: model.designRevision,
      selectedRev: model.designRevision,
      revisions: [],
      tree: [],
      positions: 0,
      assemblies: 0,
      effectivity: { serial: null, date: null, ecoCode: null, ecoHref: null },
      part: null,
      empty: true,
    };
  }
  const selectedRev =
    opts.rev && revs.includes(opts.rev) ? opts.rev : model.designRevision;

  // Every revision's tree — the ladder's "what changed" is a diff between
  // neighbours, so the cheapest correct thing is to resolve them all once.
  const treesByRev = new Map<string, BomNode[]>();
  for (const r of revs) treesByRev.set(r, await getBomTree(db, model.id, r));

  // The ECOs referenced by any part revision in play, resolved in one query.
  const ecoCodes = new Set<string>();
  for (const nodes of treesByRev.values())
    for (const n of flattenTree(nodes))
      if (n.originatingEcoId) ecoCodes.add(n.originatingEcoId);
  const ecos = ecoCodes.size
    ? await db.eCO.findMany({
        where: { code: { in: [...ecoCodes] } },
        select: {
          code: true,
          title: true,
          changeClass: true,
          effectiveFromSerial: true,
          effectiveFromDate: true,
        },
      })
    : [];
  const ecoByCode = new Map(ecos.map((e) => [e.code, e]));

  // A line with no ECO of its own is still effective as part of THIS revision, so
  // it falls back to the revision's serial rather than reading as unknown ("—").
  // The fallback is resolved after the ladder below, hence the late binding.
  let revSerial: string | null = null;
  const toLine = (n: BomNode): BomTreeLine => {
    const eco = n.originatingEcoId ? ecoByCode.get(n.originatingEcoId) : null;
    return {
      position: n.position,
      name: n.description,
      partNumber: n.partNumber,
      rev: `rev ${n.rev}`,
      qty: n.qty,
      effectivity: effLabel(eco?.effectiveFromSerial ?? revSerial),
      depth: n.depth,
      isAssembly: n.children.length > 0,
      // Substitution/version churn is the NORMAL case — the flag is ink, never
      // an error state (brand invariant: no invented reds).
      flag:
        n.lifecycleStatus === "superseded"
          ? "SUPERSEDED"
          : n.lifecycleStatus === "ncr_hold"
            ? "ON HOLD"
            : null,
      href: entityRoute("PART", n.partNumber),
      children: n.children.map(toLine),
    };
  };

  const flatSelected = flattenTree(treesByRev.get(selectedRev) ?? []);
  const assemblies = flatSelected.filter((n) => n.children.length > 0).length;

  // ── the revision ladder ────────────────────────────────────────────────────
  // For each revision: the positions it added and the parts whose revision it
  // bumped, against the revision below it. The driving ECO is the one recorded
  // on the part revisions it introduced (`PartRevision.originatingEcoId`), so
  // the ECO chip and the effectivity band are a join, never a caption.
  const revisions: BomRevision[] = revs
    .map((r, i): BomRevision => {
      const nodes = flattenTree(treesByRev.get(r) ?? []);
      const prev =
        i > 0 ? flattenTree(treesByRev.get(revs[i - 1] as string) ?? []) : null;
      const prevByPos = new Map((prev ?? []).map((n) => [n.position, n]));
      const added = prev ? nodes.filter((n) => !prevByPos.has(n.position)) : [];
      const bumped = prev
        ? nodes.filter((n) => {
            const before = prevByPos.get(n.position);
            return before && before.rev !== n.rev;
          })
        : [];
      const introduced = [...added, ...bumped];
      const ecoCode =
        introduced
          .map((n) => n.originatingEcoId)
          .find((c): c is string => !!c) ?? null;
      const eco = ecoCode ? ecoByCode.get(ecoCode) : null;

      const parts: string[] = [];
      for (const n of bumped) {
        const before = prevByPos.get(n.position);
        parts.push(
          `${n.position} ${n.partNumber} rev ${before?.rev} → ${n.rev}`,
        );
      }
      for (const n of added) parts.push(`${n.position} ${n.partNumber} added`);
      const change = !prev
        ? `Initial production baseline for the ${model.code} platform.`
        : parts.length === 0
          ? "No BOM change — revision carried forward."
          : `${parts.slice(0, 2).join(" · ")}${parts.length > 2 ? ` · +${parts.length - 2} more` : ""}.`;

      return {
        rev: r,
        isCurrent: r === model.designRevision,
        change,
        ecoCode,
        ecoHref: ecoCode ? entityRoute("ECO", ecoCode) : null,
        effect: eco?.effectiveFromSerial
          ? `From ${eco.effectiveFromSerial}`
          : "Baseline",
        date: isoDate(eco?.effectiveFromDate),
      };
    })
    .reverse(); // newest first, as the rail reads

  const selected = revisions.find((r) => r.rev === selectedRev) ?? null;
  const selectedEco = selected?.ecoCode
    ? ecoByCode.get(selected.ecoCode)
    : null;
  revSerial = selectedEco?.effectiveFromSerial ?? null;
  const tree = (treesByRev.get(selectedRev) ?? []).map(toLine);

  // ── the per-part expand ────────────────────────────────────────────────────
  let part: BomPartDetail | null = null;
  const node = opts.position
    ? flatSelected.find((n) => n.position === opts.position)
    : undefined;
  if (node) {
    // "Superseded by" is a real join, not a caption: a SUPERSEDE-class ECO that
    // names this part, and the part revision that ECO introduced.
    const supersedeEcos = await db.eCO.findMany({
      where: { changeClass: "SUPERSEDE" },
      select: { code: true, title: true, affected: true },
    });
    const naming = supersedeEcos.find(
      (e) =>
        e.title.includes(node.partNumber) ||
        e.affected.includes(node.partNumber),
    );
    let supersededBy: string | null = null;
    if (naming) {
      const successor = await db.partRevision.findFirst({
        where: { originatingEcoId: naming.code },
        select: { rev: true, partMaster: { select: { partNumber: true } } },
      });
      if (successor)
        supersededBy = `${successor.partMaster.partNumber} rev ${successor.rev} (${naming.code})`;
    }
    const nodeEco = node.originatingEcoId
      ? ecoByCode.get(node.originatingEcoId)
      : null;
    // Every position carrying this part number — the ref-des list ("A2/A3").
    const refDes = flatSelected
      .filter((n) => n.partNumber === node.partNumber)
      .map((n) => n.position)
      .join("/");
    part = {
      position: node.position,
      name: node.description,
      partNumber: node.partNumber,
      rev: `rev ${node.rev}`,
      qty: node.qty,
      refDes,
      lifecycleStatus: node.lifecycleStatus,
      approved: node.lifecycleStatus === "active",
      effectivity: nodeEco?.effectiveFromSerial
        ? `From ${nodeEco.effectiveFromSerial}${isoDate(nodeEco.effectiveFromDate) ? ` · ${isoDate(nodeEco.effectiveFromDate)}` : ""}`
        : "Baseline",
      supersededBy,
      inventoryHref: entityRoute("PART", node.partNumber),
      ecoCode: naming?.code ?? node.originatingEcoId,
      ecoHref: naming
        ? entityRoute("ECO", naming.code)
        : node.originatingEcoId
          ? entityRoute("ECO", node.originatingEcoId)
          : null,
    };
  }

  return {
    modelCode: model.code,
    modelName: model.name,
    currentRev: model.designRevision,
    selectedRev,
    revisions,
    tree,
    positions: flatSelected.filter((n) => n.children.length === 0).length,
    assemblies,
    effectivity: {
      serial: selectedEco?.effectiveFromSerial ?? null,
      date: isoDate(selectedEco?.effectiveFromDate),
      ecoCode: selected?.ecoCode ?? null,
      ecoHref: selected?.ecoHref ?? null,
    },
    part,
    empty: false,
  };
}

/** The models a BOM exists for — the registry the route falls back to. */
export async function listBomModels(
  orgId: string,
): Promise<{ code: string; name: string; rev: string }[]> {
  const db = dbForOrg(orgId);
  const models = await db.productModel.findMany({
    select: { code: true, name: true, designRevision: true },
    orderBy: { code: "asc" },
  });
  return models.map((m) => ({
    code: m.code,
    name: m.name,
    rev: m.designRevision,
  }));
}
