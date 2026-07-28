import { dbForOrg } from "@axona/db";
import { affectedUnits } from "@axona/agents";

// PLM.12 — the Change Orders LIST read model (`Change Orders.dc.html`). The change
// queue: what's proposed / in review / approved / released, what each change touches
// (the SHARED ONT.1 blast-radius traversal, computed — never a stored count), and
// "what's waiting on MY approval" (a first-class, server-side per-user query over the
// EcoReviewer roster). Filters compose server-side. The list ROUTES to the detail;
// approval stays gated on the detail via decide("eco.release"). Org-scoped.

export type ChangeStatus = "draft" | "in_review" | "approved" | "released";

/** Units past this count read heavier (ink) so large-impact changes surface first. */
const HEAVY_IMPACT = 20;

const STAGE_TO_STATUS: Record<string, ChangeStatus> = {
  DRAFT: "draft",
  REVIEW: "in_review",
  APPROVED: "approved",
  RELEASED: "released",
};

const STATUS_LABEL: Record<ChangeStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  released: "Released",
};

/** Change classification for the Type column — the stored class, else derived. */
function classify(eco: { changeClass: string | null; title: string }): string {
  if (eco.changeClass) return eco.changeClass;
  const t = eco.title.toLowerCase();
  if (/supersede|→|->/.test(t)) return "SUPERSEDE";
  if (/deviation/.test(t)) return "DEVIATION";
  return "REVISE";
}

export interface ChangeReviewerChip {
  initials: string;
  approved: boolean;
}
export interface ChangeRow {
  code: string;
  title: string;
  changeClass: string;
  status: ChangeStatus;
  statusLabel: string;
  affectedUnits: number;
  heavyImpact: boolean;
  effectivity: string;
  reviewers: ChangeReviewerChip[];
  approvalText: string;
  awaitingMe: boolean;
  agentDrafted: boolean;
  confidence: number | null;
  source: string | null;
  href: string;
}
export interface ChangeStats {
  awaitingMe: number;
  draft: number;
  inReview: number;
  approved: number;
  released: number;
  total: number;
}
export interface ChangeOrdersFilter {
  status?: ChangeStatus;
  changeClass?: string; // SUPERSEDE | REVISE | DEVIATION
  awaitingMe?: boolean;
}
export interface ChangeOrdersResult {
  rows: ChangeRow[];
  stats: ChangeStats;
  total: number; // rows matching the active filters
  awaitingMeActive: boolean;
}

/**
 * FIRST-CLASS server-side "awaiting my approval" query. Returns the set of ECO ids on
 * which `userId` is a PENDING reviewer (a real per-user DB query over EcoReviewer — NOT
 * a client filter over the full list). Both the stat tile and the filter read from this.
 */
export async function awaitingMyApproval(
  orgId: string,
  userId: string | null,
): Promise<Set<string>> {
  if (!userId) return new Set();
  const db = dbForOrg(orgId);
  const rows = await db.ecoReviewer.findMany({
    where: { userId, state: "pending" },
    select: { ecoId: true },
  });
  return new Set(rows.map((r) => r.ecoId));
}

function effectivityLabel(eco: {
  effectiveFromSerial: string | null;
  effectiveFromDate: Date | null;
}): string {
  if (eco.effectiveFromSerial) return `From ${eco.effectiveFromSerial}`;
  if (eco.effectiveFromDate)
    return `From ${new Date(eco.effectiveFromDate).toISOString().slice(0, 10)}`;
  return "Fleet-wide";
}

function approvalText(
  status: ChangeStatus,
  awaitingMe: boolean,
  reviewers: { state: string; label: string }[],
): string {
  if (awaitingMe) return "Waiting on you";
  if (status === "released") return "Released";
  if (status === "approved") {
    const who = reviewers.find((r) => r.state === "approved")?.label;
    return who ? `Approved · ${who}` : "Approved";
  }
  if (status === "draft") return "Not submitted";
  const approved = reviewers.filter((r) => r.state === "approved").length;
  return `${approved} of ${reviewers.length} approved`;
}

/**
 * The change queue. Filters (status × changeClass × awaiting-me) COMPOSE server-side.
 * The affected-units count on each row is the SHARED blast-radius traversal. Org-scoped.
 */
export async function getChangeOrders(
  orgId: string,
  filter: ChangeOrdersFilter,
  currentUserId: string | null,
): Promise<ChangeOrdersResult> {
  const db = dbForOrg(orgId);
  const [ecos, awaitingSet] = await Promise.all([
    db.eCO.findMany({
      include: { reviewers: true },
      orderBy: { code: "desc" },
    }),
    awaitingMyApproval(orgId, currentUserId),
  ]);

  // Build every row (with the shared affected-units traversal) before filtering, so the
  // stat strip reflects the WHOLE queue while the table honours the active filters.
  const all = await Promise.all(
    ecos.map(async (eco) => {
      const status = STAGE_TO_STATUS[eco.stage] ?? "draft";
      const awaitingMe = awaitingSet.has(eco.id);
      // affected-units = the SAME ONT.1 blast-radius façade the detail/blast-radius use.
      const af = await affectedUnits(db, { ecoId: eco.code });
      const count = af.units.length;
      const reviewers = eco.reviewers;
      const row: ChangeRow = {
        code: eco.code,
        title: eco.title,
        changeClass: classify(eco),
        status,
        statusLabel: STATUS_LABEL[status],
        affectedUnits: count,
        heavyImpact: count > HEAVY_IMPACT,
        effectivity: effectivityLabel(eco),
        reviewers: reviewers.map((r) => ({
          initials: r.label,
          approved: r.state === "approved",
        })),
        approvalText: approvalText(status, awaitingMe, reviewers),
        awaitingMe,
        agentDrafted: eco.draftedByAgentId !== null,
        confidence: eco.confidence,
        source: eco.source,
        href: `/changes/${encodeURIComponent(eco.code)}`,
      };
      return row;
    }),
  );

  const stats: ChangeStats = {
    awaitingMe: all.filter((r) => r.awaitingMe).length,
    draft: all.filter((r) => r.status === "draft").length,
    inReview: all.filter((r) => r.status === "in_review").length,
    approved: all.filter((r) => r.status === "approved").length,
    released: all.filter((r) => r.status === "released").length,
    total: all.length,
  };

  // Compose the filters server-side.
  const rows = all.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.changeClass && r.changeClass !== filter.changeClass)
      return false;
    if (filter.awaitingMe && !r.awaitingMe) return false;
    return true;
  });

  return {
    rows,
    stats,
    total: rows.length,
    awaitingMeActive: !!filter.awaitingMe,
  };
}
