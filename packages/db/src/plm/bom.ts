/**
 * PLM.13 — the as-designed BOM, read two ways.
 *
 * The BOM is a TREE (`BomLine.parentLineId`), and it exists at more than one
 * design revision. Every consumer wants one of exactly two shapes:
 *
 *  · `asDesignedLeaves` — the flat set of PHYSICAL positions at one revision.
 *    Build readiness (BR.1), the as-built diff (PLM.4) and as-built capture all
 *    want this: an assembly node is not a purchasable, installable part, so
 *    letting one through invents a line nothing can source or scan against.
 *  · `getBomTree` — the nested tree the BOM screen renders.
 *
 * Both are org-scoped through the caller's `OrgScopedDb` and both take the design
 * revision EXPLICITLY. Before this existed the flat readers queried `bomLine` by
 * `productModelId` alone, which was correct only while exactly one revision was
 * seeded — with a revision ladder in place that silently unions every revision.
 */
import type { OrgScopedDb } from "../client";

export interface BomLeaf {
  id: string;
  position: string;
  qty: number;
  partRevisionId: string;
  rev: string;
  partNumber: string;
  description: string;
  lifecycleStatus: string;
}

export interface BomNode extends BomLeaf {
  /** Depth from the root, 0-based — the tree's indent comes from this. */
  depth: number;
  /** The ECO that introduced this part revision, if any (scalar code). */
  originatingEcoId: string | null;
  children: BomNode[];
}

const SELECT = {
  id: true,
  position: true,
  qty: true,
  parentLineId: true,
  partRevisionId: true,
  partRevision: {
    select: {
      rev: true,
      originatingEcoId: true,
      partMaster: {
        select: {
          partNumber: true,
          description: true,
          lifecycleStatus: true,
        },
      },
    },
  },
} as const;

interface RawLine {
  id: string;
  position: string;
  qty: number;
  parentLineId: string | null;
  partRevisionId: string;
  partRevision: {
    rev: string;
    originatingEcoId: string | null;
    partMaster: {
      partNumber: string;
      description: string;
      lifecycleStatus: string;
    };
  };
}

async function rawLines(
  db: OrgScopedDb,
  productModelId: string,
  designRevision: string,
): Promise<RawLine[]> {
  return (await db.bomLine.findMany({
    where: { productModelId, designRevision },
    select: SELECT,
    orderBy: { position: "asc" },
  })) as RawLine[];
}

function flatten(l: RawLine): BomLeaf {
  return {
    id: l.id,
    position: l.position,
    qty: l.qty,
    partRevisionId: l.partRevisionId,
    rev: l.partRevision.rev,
    partNumber: l.partRevision.partMaster.partNumber,
    description: l.partRevision.partMaster.description,
    lifecycleStatus: l.partRevision.partMaster.lifecycleStatus,
  };
}

/**
 * The leaves of a set of BOM lines — every line no other line calls its parent.
 * Shape-agnostic on purpose: the flat readers each select their own columns, and
 * making them all adopt one row type would be a bigger change than the rule it
 * enforces. With a flat BOM this returns its input, so it is a no-op on data
 * that predates the tree.
 */
export function leafOnly<T extends { id: string; parentLineId: string | null }>(
  lines: T[],
): T[] {
  const parents = new Set(
    lines.map((l) => l.parentLineId).filter((id): id is string => !!id),
  );
  return lines.filter((l) => !parents.has(l.id));
}

/**
 * The physical positions at one design revision — every line that is not a
 * parent of another line. With a flat BOM (no assemblies) this is every line, so
 * it is a no-op on data that predates the tree.
 */
export async function asDesignedLeaves(
  db: OrgScopedDb,
  productModelId: string,
  designRevision: string,
): Promise<BomLeaf[]> {
  const lines = await rawLines(db, productModelId, designRevision);
  return leafOnly(lines).map(flatten);
}

/** The nested as-designed tree at one design revision (roots first). */
export async function getBomTree(
  db: OrgScopedDb,
  productModelId: string,
  designRevision: string,
): Promise<BomNode[]> {
  const lines = await rawLines(db, productModelId, designRevision);
  const byId = new Map<string, BomNode>();
  for (const l of lines) {
    byId.set(l.id, {
      ...flatten(l),
      depth: 0,
      originatingEcoId: l.partRevision.originatingEcoId,
      children: [],
    });
  }
  const roots: BomNode[] = [];
  for (const l of lines) {
    const node = byId.get(l.id) as BomNode;
    const parent = l.parentLineId ? byId.get(l.parentLineId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  // Depth is assigned by walking, not stored — a line's depth is a property of
  // where it sits, and storing it would be a second truth to keep in sync.
  const walk = (nodes: BomNode[], depth: number): void => {
    for (const n of nodes) {
      n.depth = depth;
      walk(n.children, depth + 1);
    }
  };
  walk(roots, 0);
  return roots;
}

/** Every node of a tree, depth-first — for counting and lookups. */
export function flattenTree(nodes: BomNode[]): BomNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}
