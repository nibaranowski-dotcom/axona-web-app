import {
  dbForOrg,
  getEntityLinks,
  relationLabel,
  resolveEntityId,
  type LinkDirection,
} from "@axona/db";
import type { EntityType, LinkRelation } from "@axona/db";

// LINK.1 — the read model for the <ConnectedObjects> panel. It is a THIN caller of
// the shared ONT.1 1-hop primitive (getEntityLinks): resolve the record's human
// code → the id the graph is keyed on, fetch its DIRECT neighbors (both
// directions, resolved to code/label/route/note), drop any unresolved (deleted)
// neighbor, and group by relation. 1-hop only — the N-hop cascade is blast radius.
// Org-scoped via dbForOrg; read access is authentication + org-scoping (no role
// gate on reads), so the calling page's getCurrentUser is the guard.

export interface ConnectedItem {
  type: EntityType;
  code: string;
  label: string;
  route: string;
  direction: LinkDirection;
  /** the human-readable "why" carried on the edge (EntityLink.note). */
  note: string | null;
}

export interface ConnectedGroup {
  relation: LinkRelation;
  relationLabel: string; // "caused by"
  items: ConnectedItem[];
}

export async function getConnectedObjects(
  orgId: string,
  type: EntityType,
  code: string,
): Promise<ConnectedGroup[]> {
  const db = dbForOrg(orgId);
  const id = await resolveEntityId(db, type, code);
  if (!id) return [];

  const neighbors = await getEntityLinks(db, { type, id });

  const byRelation = new Map<LinkRelation, ConnectedItem[]>();
  for (const n of neighbors) {
    // real records only — a deleted neighbor has no code/route (never invented).
    if (!n.code || !n.label || !n.route) continue;
    const arr = byRelation.get(n.relation) ?? [];
    arr.push({
      type: n.type,
      code: n.code,
      label: n.label,
      route: n.route,
      direction: n.direction,
      note: n.note,
    });
    byRelation.set(n.relation, arr);
  }

  return [...byRelation.entries()]
    .map(([relation, items]) => ({
      relation,
      relationLabel: relationLabel(relation),
      items: items.sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.relation.localeCompare(b.relation));
}

/**
 * DEMO.6 #10 — resolve a module screen's `?focus=<code>` into the record + its 1-hop
 * neighbours, so the three list screens on the fault loop wire focus identically
 * instead of each inventing it. Returns null when the param is absent or names
 * nothing on this tenant — an unknown code must render the plain screen, never a
 * fabricated record.
 *
 * Deliberately the SAME getConnectedObjects the detail views use: one read model.
 */
export interface FocusedRecordData {
  type: EntityType;
  code: string;
  label: string | null;
  groups: ConnectedGroup[];
}

export async function getFocusedRecord(
  orgId: string,
  type: EntityType,
  focus: string | string[] | undefined,
  label: (code: string) => Promise<string | null>,
): Promise<FocusedRecordData | null> {
  const code = Array.isArray(focus) ? focus[0] : focus;
  if (!code) return null;
  const db = dbForOrg(orgId);
  const id = await resolveEntityId(db, type, code);
  if (!id) return null; // unknown code → plain screen
  return {
    type,
    code,
    label: await label(code),
    groups: await getConnectedObjects(orgId, type, code),
  };
}
