import Link from "next/link";
import { ChevronDown, Download, FileDown, Lock } from "lucide-react";
import { DenseTable } from "@/components/ui";
import type { BomView as BomViewData, BomTreeLine } from "@/lib/bom";

// PLM.13 — the BOM (as-designed) screen (`BOM.dc.html` 1:1 on DS.1 primitives).
// The multi-level tree at a chosen design revision IS the screen: assemblies →
// sub-assemblies → parts, each line carrying its part revision · qty · position ·
// effectivity. The revision selector and the per-part expand are URL state, so
// every view of this screen is addressable and server-resolved (no client store).
// DETAIL screen → breadcrumbs. v2 tokens only · no invented reds.

// TABLE.1 contract — content-independent tracks: every track is minmax()/px, never
// a bare `Nfr`. Floors are the measured max-content of the columns that must not
// wrap (part number 96px · revision 62px), both below what they resolve to at the
// design width, so this is a no-op there.
const COLS =
  "grid grid-cols-[minmax(0,2.4fr)_minmax(96px,1.2fr)_minmax(62px,0.9fr)_64px_128px] gap-3 px-5";
// The tree stops compressing below its design-width layout and scrolls instead —
// the agent rail can take ~400px of this screen, and a squeezed tree is the one
// thing this screen cannot afford. NOTE for design: the leading column here is the
// TREE (indented, variable width), not a fixed identifier, so the frozen-identifier
// pattern (TABLE.1/3b/3c/2) has nothing stable to pin; flagged, not invented.
const TREE_MIN_W = "min-w-[760px]";

export function BomView({
  data,
  canImport,
}: {
  data: BomViewData;
  canImport: boolean;
}) {
  const href = (rev: string, position?: string) => {
    const p = new URLSearchParams();
    if (rev !== data.currentRev) p.set("rev", rev);
    if (position) p.set("position", position);
    const q = p.toString();
    return `/bom/${encodeURIComponent(data.modelCode)}${q ? `?${q}` : ""}`;
  };

  return (
    <div className="flex min-h-full flex-col bg-panel">
      {/* identity header */}
      <header className="flex-none border-b border-line bg-paper px-6 pb-4 pt-3.5">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-[7px] font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
            <li>
              <Link href="/engineering" className="hover:text-ink">
                Engineering
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>BOM</li>
            <li aria-hidden>/</li>
            <li className="text-ink-muted">
              {data.modelCode} · rev {data.selectedRev}
            </li>
          </ol>
        </nav>

        <div className="mt-[9px] flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[23px] font-semibold tracking-[-0.02em] text-ink">
                {data.modelName} · bill of materials
              </h1>
              <span className="inline-flex items-center gap-[7px] rounded-pill bg-success-tint px-[11px] py-1 text-[11px] font-semibold tracking-[0.03em] text-success">
                <Lock className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                rev {data.selectedRev} ·{" "}
                {data.selectedRev === data.currentRev
                  ? "baselined"
                  : "superseded"}
              </span>
            </div>
            <div className="mt-[7px] flex flex-wrap items-center gap-[9px] text-[13px] text-ink-muted">
              <span className="font-mono text-[12px]">
                {data.positions} positions
              </span>
              <span className="text-line-strong">·</span>
              <span className="font-mono text-[12px]">
                {data.assemblies} assemblies
              </span>
              <span className="text-line-strong">·</span>
              <span>as-designed source of truth</span>
            </div>
          </div>

          <div className="flex flex-none items-center gap-2.5">
            {/* design-revision selector — re-resolves the whole tree */}
            <div
              className="flex items-center overflow-hidden rounded-[9px] border border-line-strong"
              role="group"
              aria-label="Design revision"
            >
              {data.revisions
                .map((r) => r.rev)
                .reverse()
                .map((rev, i) => {
                  const active = rev === data.selectedRev;
                  return (
                    <Link
                      key={rev}
                      href={href(rev)}
                      aria-current={active ? "true" : undefined}
                      className={`px-[13px] py-2 font-mono text-[12px] font-semibold transition-colors ${i ? "border-l border-line-strong" : ""} ${
                        active
                          ? "bg-ink-strong text-on-dark"
                          : "bg-paper text-ink-muted hover:text-ink"
                      }`}
                    >
                      rev {rev}
                    </Link>
                  );
                })}
            </div>
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-btn border border-line-strong px-[15px] py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              Export
            </Link>
          </div>
        </div>

        {/* effectivity band */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
            Effectivity
          </span>
          <span className="rounded-md bg-ink-strong px-[9px] py-[3px] font-mono text-[11.5px] font-semibold text-on-dark">
            rev {data.selectedRev}
          </span>
          <span className="text-[12.5px] text-ink-muted">
            {data.effectivity.serial ? (
              <>
                applies from{" "}
                <span className="font-mono text-[11.5px] text-ink">
                  {data.effectivity.serial}
                </span>
              </>
            ) : (
              <>initial production baseline</>
            )}
            {data.effectivity.date && (
              <>
                {" · effective "}
                <span className="font-mono text-[11.5px] text-ink">
                  {data.effectivity.date}
                </span>
              </>
            )}
            {data.effectivity.ecoCode && data.effectivity.ecoHref && (
              <>
                {" · driven by "}
                <Link
                  href={data.effectivity.ecoHref}
                  className="font-mono text-[11.5px] text-ink hover:underline"
                >
                  {data.effectivity.ecoCode}
                </Link>
              </>
            )}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-[18px] px-6 pb-7 pt-5">
          {data.empty ? (
            <ImportBand canImport={canImport} empty />
          ) : (
            <>
              {/* BOM TREE — the signature artifact */}
              <section className="flex-none rounded-card border border-line bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 pb-3 pt-[15px]">
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">
                      Multi-level bill of materials
                    </h2>
                    <p className="mt-[3px] text-[12px] text-ink-muted">
                      Assemblies → sub-assemblies → parts. Each line carries its
                      part revision, quantity, and position.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-faint">
                    {data.positions} positions · {data.assemblies} assemblies
                  </span>
                </div>

                <DenseTable
                  minWidth={TREE_MIN_W}
                  label="Bill of materials tree"
                  className="rounded-b-card"
                >
                  <div
                    className={`${COLS} bg-paper border-b border-line py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint`}
                  >
                    <span>Position · item</span>
                    <span>Part number</span>
                    <span>Revision</span>
                    <span>Qty</span>
                    <span>Effectivity</span>
                  </div>

                  {data.tree.map((node) => (
                    <TreeBranch
                      key={node.position}
                      node={node}
                      href={href}
                      rev={data.selectedRev}
                      selected={data.part?.position ?? null}
                    />
                  ))}

                  <div className="flex flex-wrap items-center gap-3.5 bg-paper px-5 py-[11px]">
                    <span className="font-mono text-[11px] text-ink-muted">
                      Showing all {data.positions} positions · {data.assemblies}{" "}
                      assemblies expanded
                    </span>
                  </div>
                </DenseTable>
              </section>

              {/* per-part detail (the row expand) */}
              {data.part && (
                <section className="flex-none overflow-hidden rounded-card border border-line bg-paper">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-5 pb-3 pt-[15px]">
                    <div>
                      <h2 className="text-[15px] font-semibold text-ink">
                        {data.part.position} · {data.part.name}
                      </h2>
                      <div className="mt-1 font-mono text-[11.5px] text-ink-muted">
                        {data.part.partNumber} · {data.part.rev} · ×
                        {data.part.qty} · ref-des {data.part.refDes}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${data.part.approved ? "text-success" : "text-ink"}`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-pill ${data.part.approved ? "bg-success" : "bg-ink-strong"}`}
                      />
                      {data.part.approved ? "Approved" : "On hold"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3">
                    <Meta label="Current revision" border>
                      <span className="font-semibold">{data.part.rev}</span> ·{" "}
                      {data.part.lifecycleStatus.replace("_", " ")}
                    </Meta>
                    <Meta label="Effectivity" border>
                      {data.part.effectivity}
                    </Meta>
                    <Meta label="Superseded by">
                      {data.part.supersededBy ?? "—"}
                    </Meta>
                  </div>
                  <div className="flex flex-wrap items-center gap-3.5 border-t border-line px-5 py-3">
                    <Link
                      href={data.part.inventoryHref}
                      className="text-[12.5px] font-semibold text-ink hover:underline"
                    >
                      Open in Inventory →
                    </Link>
                    {data.part.ecoCode && data.part.ecoHref && (
                      <>
                        <span className="text-line-strong">·</span>
                        <Link
                          href={data.part.ecoHref}
                          className="text-[12.5px] font-semibold text-ink hover:underline"
                        >
                          {data.part.ecoCode} touches this part →
                        </Link>
                      </>
                    )}
                  </div>
                </section>
              )}

              <ImportBand canImport={canImport} />
            </>
          )}
        </div>

        {/* right rail: revision history */}
        <aside className="flex w-full flex-none flex-col gap-4 border-line bg-paper p-5 lg:w-[308px] lg:border-l">
          <div className="flex-none">
            <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
              Design revisions
            </div>
            <p className="mt-[5px] text-[12px] leading-[1.5] text-ink-muted">
              Select a revision to re-resolve the tree to that revision&rsquo;s
              content.
            </p>
          </div>
          {data.revisions.map((r) => {
            const active = r.rev === data.selectedRev;
            return (
              <Link
                key={r.rev}
                href={href(r.rev)}
                className={`flex-none rounded-[13px] border p-[14px] transition-colors ${
                  active
                    ? "border-ink-strong bg-panel"
                    : "border-line bg-paper hover:border-ink-strong"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-[9px]">
                    <span className="font-mono text-[13px] font-bold text-ink">
                      rev {r.rev}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.03em] ${
                        r.isCurrent
                          ? "bg-success-tint text-success"
                          : "bg-panel text-ink-muted"
                      }`}
                    >
                      {r.isCurrent ? "CURRENT" : "SUPERSEDED"}
                    </span>
                  </div>
                  {r.date && (
                    <span className="font-mono text-[10px] text-ink-faint">
                      {r.date}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[12px] leading-[1.45] text-ink-muted">
                  {r.change}
                </p>
                <div className="mt-[9px] flex items-center gap-2">
                  {r.ecoCode && (
                    <span className="rounded-md border border-line-panel bg-panel px-2 py-0.5 font-mono text-[10.5px] text-ink">
                      {r.ecoCode}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-ink-faint">
                    {r.effect}
                  </span>
                </div>
              </Link>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

/** An assembly and everything under it. Assemblies are open by default. */
function TreeBranch({
  node,
  href,
  rev,
  selected,
}: {
  node: BomTreeLine;
  href: (rev: string, position?: string) => string;
  rev: string;
  selected: string | null;
}) {
  if (!node.isAssembly)
    return <TreeLeaf node={node} href={href} rev={rev} selected={selected} />;
  return (
    <details open className="border-b border-line last:border-b-0">
      <summary
        className={`${COLS} cursor-pointer list-none items-center bg-paper py-3`}
      >
        <div
          className="flex min-w-0 items-center gap-[9px]"
          style={{ paddingLeft: `${node.depth * 18}px` }}
        >
          <ChevronDown
            className="h-[13px] w-[13px] flex-none text-ink-faint"
            strokeWidth={2.4}
            aria-hidden
          />
          <span className="flex-none font-mono text-[11px] text-ink-faint">
            {node.position}
          </span>
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {node.name}
          </span>
        </div>
        <span className="font-mono text-[12px] text-ink-muted">
          {node.partNumber}
        </span>
        <span className="font-mono text-[12px] font-semibold text-ink">
          {node.rev}
        </span>
        <span className="font-mono text-[11.5px] text-ink-muted">
          ×{node.qty}
        </span>
        <span className="font-mono text-[10px] text-ink-faint">
          {node.effectivity}
        </span>
      </summary>
      {node.children.map((child) => (
        <TreeBranch
          key={child.position}
          node={child}
          href={href}
          rev={rev}
          selected={selected}
        />
      ))}
    </details>
  );
}

/** A part line — selecting it expands the per-part detail below the tree. */
function TreeLeaf({
  node,
  href,
  rev,
  selected,
}: {
  node: BomTreeLine;
  href: (rev: string, position?: string) => string;
  rev: string;
  selected: string | null;
}) {
  const isSelected = selected === node.position;
  return (
    <Link
      href={href(rev, node.position)}
      aria-current={isSelected ? "true" : undefined}
      className={`${COLS} items-center border-t border-line py-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${isSelected ? "bg-panel-2" : "bg-paper hover:bg-panel-2"}`}
    >
      <div
        className="flex min-w-0 items-center gap-[9px]"
        style={{ paddingLeft: `${node.depth * 18}px` }}
      >
        <span
          aria-hidden
          className={`h-[5px] w-[5px] flex-none rounded-pill ${node.depth > 1 ? "bg-ink-faint" : "bg-line-strong"}`}
        />
        <span className="flex-none font-mono text-[11px] text-ink-faint">
          {node.position}
        </span>
        <span className="truncate text-[13px] text-ink">{node.name}</span>
        {node.flag && (
          <span className="flex-none rounded-md border border-line-panel bg-panel px-1.5 py-px font-mono text-[8.5px] tracking-[0.04em] text-ink">
            {node.flag}
          </span>
        )}
      </div>
      <span className="font-mono text-[12px] text-ink-muted">
        {node.partNumber}
      </span>
      <span className="font-mono text-[12px] font-semibold text-ink">
        {node.rev}
      </span>
      <span className="font-mono text-[11.5px] text-ink-muted">
        ×{node.qty}
      </span>
      <span className="font-mono text-[10px] text-ink-faint">
        {node.effectivity}
      </span>
    </Link>
  );
}

function Meta({
  label,
  border = false,
  children,
}: {
  label: string;
  border?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-5 py-3.5 ${border ? "border-r border-line" : ""}`}>
      <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
        {label}
      </div>
      <div className="mt-[5px] text-[13px] text-ink">{children}</div>
    </div>
  );
}

/**
 * Import-first (the brief's day-one surface): a BOM must be usable from a
 * spreadsheet before anything else exists. Routes to the IO.1 import surface —
 * the same xlsx/CSV → `bomLine` path MFX.1 uses, not a second importer.
 */
function ImportBand({
  canImport,
  empty = false,
}: {
  canImport: boolean;
  empty?: boolean;
}) {
  return (
    <section className="relative flex flex-none flex-wrap items-center gap-[18px] overflow-hidden rounded-card border border-line bg-paper px-5 py-[22px]">
      <div className="pointer-events-none absolute inset-0 bg-dotted-grid opacity-50" />
      <span className="relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-[11px] border border-line-strong bg-panel text-ink-muted">
        <FileDown className="h-5 w-5" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="relative min-w-[200px] flex-1">
        <div className="text-[14px] font-semibold text-ink">
          {empty
            ? "No BOM for this model yet."
            : "Bringing a new model online?"}
        </div>
        <p className="mt-[3px] max-w-[60ch] text-[12.5px] text-ink-muted">
          Import your BOM from a CSV or spreadsheet — positions, part numbers,
          revisions, and quantities map on the way in. No migration, value the
          same day.
        </p>
      </div>
      {canImport && (
        <div className="relative flex flex-none gap-2.5">
          <Link
            href="/import"
            className="rounded-btn bg-accent px-4 py-[9px] text-[13px] font-semibold text-accent-ink transition-colors hover:brightness-95"
          >
            Import BOM
          </Link>
          <Link
            href="/import"
            className="rounded-btn border border-line-strong px-4 py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong"
          >
            Download template
          </Link>
        </div>
      )}
    </section>
  );
}
