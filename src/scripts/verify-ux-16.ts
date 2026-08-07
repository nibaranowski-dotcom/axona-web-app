/**
 * Verify UX.16 — the Procurement PO queue has ZERO column residual. Run: pnpm verify:ux-16
 *
 * The bug: `grid-cols-[0.8fr_2.2fr_…]` — a bare `Nfr` is `minmax(auto, Nfr)`, so
 * each track's floor is its own min-content. A row whose value/status chip is wider
 * than its ratio share inflates that track and steals width from its neighbours,
 * while the header's short mono labels never do — header and rows resolve DIFFERENT
 * tracks off the same template (measured: ~22px apart at a 1280px viewport).
 *
 * The fix is a template in which EVERY track is content-independent, so the header
 * and every row resolve identically at every width. These are static source checks
 * over that invariant; `pnpm ux-16:columns` is the served measurement that proves
 * the pixels (it needs the app running, so it is not part of verify:all).
 *
 * Guards:
 *   1. One shared template — the header uses the SAME exported const as every row.
 *   2. No `auto`-floored track survives in the template (no bare `Nfr`).
 *   3. The status track is a FIXED width (no chip can reflow the row).
 *   4. The identifier + money tracks carry measured px floors (never truncated away).
 *   5. The actions track stays 160px (UX.5 — buttons don't shift the other columns).
 *   6. Numeric/date cells are `tabular-nums`.
 *   7. The UX.15 chain holds: every truncating cell has `min-w-0`.
 *   8. BR.1 is intact — promised/received + LATE + Single-source/Long-lead still
 *      render, and the flags clip at the track edge (shrink-0 + overflow-hidden)
 *      rather than painting over the Vendor column.
 *   9. v2 tokens only — no raw hex in the touched files.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The class list of whatever element renders `{po.code}` — span or Link. Checks 6
 * and 7 both assert properties of that cell, so they read it the same way instead of
 * each hardcoding a markup shape.
 */
function poCodeClasses(flat: string): string[] {
  const m =
    /<(?:span|Link)\b[^>]*className="([^"]*)"[^>]*>\s*\{po\.code\}/.exec(flat);
  return m?.[1]?.split(/\s+/).filter(Boolean) ?? [];
}

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

function run(): void {
  console.log("\nVerifying UX.16 — Procurement PO-queue column alignment\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const row = read("apps/web/components/procurement/PoRow.tsx");
  const queue = read("apps/web/components/procurement/PoQueue.tsx");
  const view = read("apps/web/components/procurement/ProcurementView.tsx");

  check("PoRow.tsx / PoQueue.tsx / ProcurementView.tsx exist", () => {
    return row.length > 0 && queue.length > 0 && view.length > 0;
  });

  // The grid template, as a single literal (Tailwind can't see composed strings).
  // Anchored on `grid grid-cols-[` so the prose in the comment above it can't match.
  const template = /"grid grid-cols-\[([^\]]+)\]/.exec(row)?.[1] ?? "";
  check("PoRow declares the grid template as one literal string", () => {
    return template.length > 0 && !/grid-cols-\[\$\{/.test(row);
  });

  check("1. header and rows share ONE template (PO_HEADER_COLS = COLS)", () => {
    return (
      /export const PO_HEADER_COLS = COLS;/.test(row) &&
      /PO_HEADER_COLS/.test(queue) &&
      // the row itself renders with the same const
      /className=\{`\$\{COLS\}/.test(row) &&
      // and nothing re-declares a second grid template on this screen
      (queue.match(/grid-cols-\[/g) ?? []).length === 0
    );
  });

  // Split the template on top-level underscores (minmax(…) keeps its commas).
  const tracks = template.split(/_(?![^(]*\))/);

  check(
    "2. no auto-floored track survives (no bare `Nfr` in the template)",
    () => {
      if (tracks.length !== 6) return false;
      return tracks.every((t) => !/^[\d.]+fr$/.test(t));
    },
  );

  check("3. the status track is a fixed px width", () => {
    return /^\d+px$/.test(tracks[4] ?? "");
  });

  check(
    "4. PO + value tracks carry px floors (identifier/money never truncated away)",
    () => {
      const po = /^minmax\((\d+)px,[\d.]+fr\)$/.exec(tracks[0] ?? "");
      const value = /^minmax\((\d+)px,[\d.]+fr\)$/.exec(tracks[3] ?? "");
      // Measured intrinsics: `PO-9001` = 52.5px, `$1,234,567` = 75px (mono 12.5px).
      return !!po && !!value && Number(po[1]) >= 53 && Number(value[1]) >= 75;
    },
  );

  check("5. the actions track stays 160px (UX.5)", () => {
    return tracks[5] === "160px";
  });

  check("6. numeric/date cells are tabular-nums", () => {
    const flat = row.replace(/\s+/g, " ");
    return (
      // PO code · item line (qty) · promised/received line · value.
      (row.match(/tabular-nums/g) ?? []).length >= 4 &&
      // Tag-agnostic: the DEMO beat-2/3 work made the PO code a Link to its detail
      // surface, so this matches the PROPERTY (the element rendering po.code carries
      // tabular-nums) rather than requiring a <span>. Read the class list off that
      // element and test it directly — a looser regex here would let the match cross
      // a quote and pick up a tabular-nums from a DIFFERENT attribute, which silently
      // stops the check from biting at all.
      poCodeClasses(flat).includes("tabular-nums") &&
      // the item line carries a `title` attribute between class and text
      /truncate text-\[13\.5px\] tabular-nums text-ink"[^>]*>\s*\{po\.partSku\} · qty \{po\.qty\}/.test(
        flat,
      ) &&
      /font-mono text-\[10px\] tabular-nums/.test(flat) &&
      /tabular-nums[^"]*">\s*\$\{po\.value\.toLocaleString\(\)\}/.test(flat)
    );
  });

  check("6b. the queue footer count is tabular-nums", () => {
    return /text-\[11px\] tabular-nums/.test(queue);
  });

  check("7. UX.15 chain holds — every truncating cell has min-w-0", () => {
    const flat = row.replace(/\s+/g, " ");
    const flatQueue = queue.replace(/\s+/g, " ");
    // Assert the PROPERTY, not one markup shape: UX.17 made the PO cell a sticky
    // min-w-0 flex wrapper with the truncating text as its child, so the chain now
    // reads `min-w-0 parent > truncate child` there while the other cells still
    // carry both classes themselves. Either arrangement satisfies UX.15; a
    // `truncate` with NO min-w-0 anywhere in its chain does not.
    const cells = flat.match(/className="[^"]*truncate[^"]*"/g) ?? [];
    if (cells.length < 3) return false;
    // Item · Vendor · Value · Status header labels keep both classes inline.
    const headerCells = queue.match(/className="min-w-0 truncate"/g) ?? [];
    // The PO header label: a min-w-0 sticky cell wrapping a truncating child.
    const poHeader =
      /\$\{PO_STICKY_PO\} min-w-0`?\}?>\s*<span className="truncate">PO<\/span>/.test(
        flatQueue,
      );
    // The PO code cell: same shape, and still mono + tabular-nums (UX.16 check 6).
    // The PO code cell: same CHAIN (min-w-0 sticky wrapper > truncating child) and
    // the same required classes. The child is a <Link> since the DEMO beat-2/3 work
    // made the identifier open the PO's detail surface, so match on the properties
    // — every class UX.15/UX.16 depends on is still asserted, in any order.
    const poCellChain = /\$\{STICKY_PO\} min-w-0`\}>\s*<(span|Link)\b/.test(
      flat,
    );
    const poClasses = poCodeClasses(flat);
    const poCell =
      poCellChain &&
      [
        "truncate",
        "font-mono",
        "text-[12.5px]",
        "tabular-nums",
        "text-ink",
      ].every((c) => poClasses.includes(c));
    // Vendor + value cells still carry min-w-0 + truncate themselves.
    const vendorAndValue =
      /className="min-w-0 truncate text-\[13px\] text-ink-muted"/.test(flat) &&
      /className="min-w-0 truncate font-mono text-\[12\.5px\] tabular-nums text-ink"/.test(
        flat,
      );
    return headerCells.length === 4 && poHeader && poCell && vendorAndValue;
  });

  check("8. BR.1 intact — promised/received, LATE, and the flag chips", () => {
    return (
      /po\.receivedAt \?/.test(row) &&
      /Received \{fmtDate\(po\.receivedAt\)\}/.test(row) &&
      /Promised \{fmtDate\(po\.eta\)\}/.test(row) &&
      /po\.late &&/.test(row) &&
      />\s*Late\s*</.test(row) &&
      /po\.singleSource && <Tag>Single-source<\/Tag>/.test(row) &&
      /po\.longLead && <Tag>Long-lead<\/Tag>/.test(row)
    );
  });

  check(
    "8b. flags clip at the track edge (shrink-0 tag + overflow-hidden row)",
    () => {
      return (
        /inline-flex shrink-0 items-center rounded-\[4px\]/.test(row) &&
        /flex min-w-0 items-center gap-2 overflow-hidden/.test(row)
      );
    },
  );

  check("9. v2 tokens only — no raw hex in the touched files", () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    return !hex.test(row) && !hex.test(queue) && !hex.test(view);
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
