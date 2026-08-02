import {
  advanceEco,
  approveEcoRelease,
  rejectEcoRelease,
} from "@/app/(shell)/engineering/actions";
import type { Eco } from "@/lib/engineering";
import { DenseTable, FROZEN_CELL } from "@/components/ui";

// The change-orders table (Engineering.dc.html) — ECO · Change · Type · Affected
// · Stage, plus role-gated actions. Stage carried by a dot (neutral · lime in
// review · green approved) with ink text — AA-safe, brand palette only. RELEASE is
// the gated human decision: a pre-release ECO (REVIEW/APPROVED) shows Approve
// release / Reject via the RBAC.5 primitive (audited); a DRAFT just submits.
const STAGE: Record<string, { dot: string; label: string }> = {
  DRAFT: { dot: "bg-line-strong", label: "Draft" },
  REVIEW: { dot: "bg-accent", label: "Review" },
  APPROVED: { dot: "bg-success", label: "Approved" },
  RELEASED: { dot: "bg-ink-faint", label: "Released" },
};

// UX.15 companion fix: the last (action) column is a FIXED width, not `auto`. With
// `auto` the track sized to each row's own content (Reject+Approve buttons ≈186px on
// pre-release rows, nothing on released rows), so the `fr` tracks resolved to different
// widths per row and the data columns drifted out of alignment. A fixed 190px track
// (buttons right-aligned via justify-end) makes every row's grid identical → columns flush.
//
// TABLE.3c — content-independent tracks (the UX.16 rule): a bare `Nfr` is
// `minmax(auto, Nfr)`, whose floor is the track's own min-content, so rows inflate
// their tracks while the short header labels do not. Floors are the MEASURED
// max-content of the two columns that must never clip — ECO 51px, Type 26px — each
// already below what that column resolves to at the design width (57px / 43px), so
// they are a no-op there and only bind once the table is at its floor. Change and
// Affected are long free text that truncates by design, and Stage's pill is measured
// below, so those stay `minmax(0, …)`.
const COLS =
  "grid grid-cols-[minmax(51px,0.8fr)_minmax(0,2.4fr)_minmax(26px,0.6fr)_minmax(0,1.6fr)_minmax(0,1fr)_190px] items-center gap-3 px-5";

// The width below which the table scrolls instead of compressing: its DESIGN-WIDTH
// layout (1440 → a 748px card, 746px inside the 1px borders). At 1440 there is
// nothing to scroll and every track resolves exactly as it did before this story;
// below it the table holds that layout and scrolls, which is also what settles the
// ~3px ECO-code clip TABLE.1 logged at 1366 (the track was 47.75px against 51px of
// mono code — at the floor it is 57px). Sized to the card's CONTENT box, inside the
// borders, for the same reason /units reads 998 and not 1000 (TABLE.3b).
const ECO_MIN_W = "min-w-[746px]";
// Header and rows paint an EXPLICIT opaque background so the frozen cell's
// `bg-inherit` occludes what slides under it — and follow :hover with it.
const HEADER_BG = "bg-paper";
const ROW_BG = "bg-paper hover:bg-panel-2";
const FROZEN_ECO = FROZEN_CELL["px-5"];

export function EcoTable({
  ecos,
  canAdvance,
}: {
  ecos: Eco[];
  canAdvance: boolean;
}) {
  const inReview = ecos.filter((e) => e.stage === "REVIEW").length;
  return (
    // TABLE.3c — the canonical dense-table shell, adapted to a card that owns a
    // heading. The rule the pattern turns on is that NO clipping box may sit between
    // the sticky cell and the scroller; this card used to be `overflow-hidden`, which
    // is exactly the box that made the identifier scroll away. It now clips nothing,
    // and the scroller (with the bottom corners, so the last row's opaque background
    // still rounds off) wraps ONLY the table — so the heading stays put instead of
    // sliding out sideways with the rows. Change Orders.dc.html keeps its heading
    // outside the card and so needs no equivalent; this is the same shape, not a
    // second pattern.
    <section
      aria-label="Change orders"
      className="rounded-card border border-line bg-paper"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Change orders</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {ecos.length} open · {inReview} in review
        </span>
      </div>
      <DenseTable
        minWidth={ECO_MIN_W}
        label="Change orders table"
        className="rounded-b-card"
      >
        <div
          className={`${COLS} ${HEADER_BG} border-t border-line py-[10px] font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted`}
        >
          <span className={FROZEN_ECO}>ECO</span>
          <span>Change</span>
          <span>Type</span>
          <span>Affected</span>
          <span>Stage</span>
          <span className="sr-only">Action</span>
        </div>
        {ecos.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-muted">
            No change orders.
          </p>
        ) : (
          ecos.map((e) => {
            const stage = STAGE[e.stage] ?? {
              dot: "bg-line-strong",
              label: e.stage,
            };
            const preRelease = e.stage === "REVIEW" || e.stage === "APPROVED";
            return (
              <div
                key={e.id}
                className={`${COLS} ${ROW_BG} border-t border-line py-[13px]`}
              >
                <span
                  className={`${FROZEN_ECO} font-mono text-[12px] text-ink`}
                >
                  {e.code}
                </span>
                <span
                  className="min-w-0 truncate text-[13px] text-ink"
                  title={e.title}
                >
                  {e.title}
                </span>
                <span>
                  <span className="rounded-[5px] border border-line-panel bg-panel px-[6px] py-px font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
                    {e.changeType}
                  </span>
                </span>
                <span
                  className="min-w-0 truncate font-mono text-[10.5px] text-ink-muted"
                  title={e.affected}
                >
                  {e.affected}
                </span>
                <span>
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-panel px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] text-ink">
                    <span
                      aria-hidden
                      className={`h-[6px] w-[6px] rounded-pill ${stage.dot}`}
                    />
                    {stage.label}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  {canAdvance && preRelease ? (
                    <>
                      <form action={rejectEcoRelease.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Reject
                        </button>
                      </form>
                      <form action={approveEcoRelease.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Approve release
                        </button>
                      </form>
                    </>
                  ) : canAdvance && e.stage === "DRAFT" ? (
                    <form action={advanceEco.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Submit
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </DenseTable>
    </section>
  );
}
