import type { PoDetail as PoDetailData } from "@/lib/procurement";

// DEMO — the PO detail surface (warehouse beats 2 & 3).
//
// Rendered UNDER <FocusedRecord> on /procurement?focus=<code>, so it reuses the LINK.2
// arrival surface rather than introducing a second navigation concept: an EntityLink
// hop to a PO and a click on a PO row now land in exactly the same place.
//
// It shows two things, both read from records that already existed and neither of them
// recomputed here:
//   · the agent's ACTION — the AUDIT.1 entry it wrote, with the four accountability
//     fields (model · confidence · approver). "The agent chased it" is only a claim
//     until you can see when, what it said, and who was accountable.
//   · the goods-receipt 3-WAY MATCH — PO qty vs packing-list qty vs invoice, plus the
//     serials captured into genealogy at receipt.
//
// Every faint label uses `text-mono-faint` (A11Y.3: `ink-faint` is 4.49:1 on panel-2
// and fails AA as small text). No invented reds — a mismatch renders in ink.

function fmtWhen(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-mono-faint">
      {children}
    </div>
  );
}

/** One AUDIT.1 entry: what happened, then who was accountable for it. */
function AuditEntry({ e }: { e: PoDetailData["audit"][number] }) {
  const isAgent = e.actorType === "AGENT";
  return (
    <li className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] tabular-nums text-mono-faint">
          {fmtWhen(e.at)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          {e.action}
        </span>
        <span className="text-[12px] text-ink-muted">· {e.actorLabel}</span>
      </div>
      <p className="mt-1 max-w-[80ch] text-[12.5px] leading-[1.45] text-ink">
        {e.summary}
      </p>
      {/* AUDIT.1's accountability fields. An AGENT entry states the model + the
          confidence it emitted; a HUMAN entry states the approver. Rendered only
          when present — an absent field is left absent, never defaulted. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-mono-faint">
        {isAgent && e.model && <span>model {e.model}</span>}
        {isAgent && e.confidence != null && (
          <span>confidence {e.confidence.toFixed(2)}</span>
        )}
        {e.approverLabel && <span>approved by {e.approverLabel}</span>}
        {!isAgent && !e.approverLabel && <span>human action</span>}
      </div>
    </li>
  );
}

/** PO qty = packing-list qty = invoice — the receiving agent's own reconciliation. */
function ThreeWay({ m }: { m: NonNullable<PoDetailData["threeWay"]> }) {
  const rows: { label: string; value: string }[] = [
    { label: "Purchase order", value: `${m.poQty} ordered` },
    {
      label: "Packing list",
      value:
        m.packingListQty == null
          ? "not extracted"
          : `${m.packingListQty} received`,
    },
    {
      label: "Invoice",
      value: m.invoiceCode
        ? m.invoiceAmount != null
          ? `${m.invoiceCode} · $${m.invoiceAmount.toLocaleString()}`
          : m.invoiceCode
        : "not matched",
    },
  ];
  return (
    <div className="mt-3.5 rounded-card border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Goods receipt · 3-way match</Eyebrow>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.03em] ${
            m.matched
              ? "bg-success-tint text-ink-strong"
              : "bg-ink-strong text-on-dark"
          }`}
        >
          {m.matched && (
            <span
              aria-hidden
              className="h-[6px] w-[6px] rounded-pill bg-success"
            />
          )}
          {m.matched
            ? `Matched ${m.packingListQty ?? m.poQty}/${m.poQty}`
            : "Not matched"}
        </span>
      </div>
      <dl className="mt-2.5 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="font-mono text-[9px] uppercase tracking-[0.05em] text-mono-faint">
              {r.label}
            </dt>
            <dd className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {m.serials.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <Eyebrow>Serials captured into genealogy</Eyebrow>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {m.serials.map((s) => (
              <span
                key={s}
                className="rounded-[4px] border border-line-panel bg-panel px-1.5 py-px font-mono text-[10.5px] tabular-nums text-ink"
              >
                {s}
              </span>
            ))}
            {m.sku && (
              <span className="font-mono text-[10.5px] text-mono-faint">
                · {m.sku}
              </span>
            )}
          </div>
        </div>
      )}
      {m.sourceFile && (
        <p className="mt-2.5 font-mono text-[10px] text-mono-faint">
          Source · {m.sourceFile}
        </p>
      )}
    </div>
  );
}

export function PoDetail({ detail }: { detail: PoDetailData }) {
  const { audit, threeWay, daysLate, status } = detail;
  // The chase is an agent ACTION on a late order — surface it as the headline when
  // there is one, so beat 2's "being chased automatically" has something to point at.
  const chase = audit.find((e) => e.action.endsWith(".chase"));
  const rest = audit.filter((e) => e.id !== chase?.id);

  return (
    <section
      aria-labelledby="po-detail-title"
      className="mb-[18px] rounded-card border border-line bg-panel-2 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Purchase order detail</Eyebrow>
          <h2
            id="po-detail-title"
            className="mt-1 font-mono text-[14px] font-semibold tabular-nums text-ink"
          >
            {detail.code}
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {detail.partSku} · qty {detail.qty} · $
            {detail.value.toLocaleString()} · {detail.supplier}
          </p>
        </div>
        {daysLate != null && status === "SENT" && (
          <span className="rounded-[4px] bg-ink-strong px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-on-dark">
            {daysLate} days past promised
          </span>
        )}
      </div>

      {chase && (
        <div className="mt-3.5 rounded-card border border-line bg-paper p-4">
          <Eyebrow>Agent action · supplier chase</Eyebrow>
          <ul className="mt-2">
            <AuditEntry e={chase} />
          </ul>
        </div>
      )}

      {threeWay && <ThreeWay m={threeWay} />}

      {/* The trail excludes whatever is already shown as the headline above — the
          chase rendering twice in one panel reads as a duplication bug, not as
          emphasis. Everything else that happened to this PO is listed in order. */}
      <div className="mt-3.5">
        <Eyebrow>{chase ? "Rest of the audit trail" : "Audit trail"}</Eyebrow>
        {rest.length > 0 ? (
          <ul className="mt-2 rounded-card border border-line bg-paper px-4 py-3">
            {rest.map((e) => (
              <AuditEntry key={e.id} e={e} />
            ))}
          </ul>
        ) : (
          // Never imply an action nobody logged.
          <p className="mt-2 text-[12px] text-ink-muted">
            {chase
              ? `The supplier chase above is the only recorded action on ${detail.code}.`
              : `No recorded actions on ${detail.code} yet.`}
          </p>
        )}
      </div>
    </section>
  );
}
