/**
 * SEED.6 — scrub banned marques out of the committed design mocks.
 * Run: pnpm scrub:design            (writes in place, prints what it changed)
 *      pnpm scrub:design --dry-run  (report only, no writes)
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF. `design/**` is GENERATED — the .dc.html
 * mocks are exported from the design project. SEED.6 scrubbed them and brought
 * design/ inside `verify:seed-1`'s scan scope, so the wall now guards them. But a
 * re-export reintroduces every marque and turns that gate red: the ⌘K refresh
 * arrived carrying a real automotive marque and the scrubbed HX-2 designation, and
 * only a hand scan caught it before it was staged.
 *
 * TASK #13 — until the SOURCE design project is scrubbed, re-run this after any
 * design re-export. The gate going red after a design sync is not a false alarm; it
 * is this exact situation, and this script is the fix.
 *
 * The replacements are the ones ruled on in SEED.6. `Harmonic Drive` is deliberately
 * absent: it is the generic mechanism in this domain (a strain-wave gear — "left
 * actuator harmonic drive"), never a vendor, so it was dropped from BANNED_MARQUES
 * rather than rewritten. Anything NOT in this map that the scanner still flags needs
 * a ruling, not a guess — the script reports it and exits non-zero.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { BANNED_MARQUES, scanForMarques } from "./lib/anonymization";

/**
 * Ordered longest/most-specific FIRST so "HX-2" is consumed before "HX2" can
 * partially match it, and so a replacement is never itself re-matched.
 */
const REPLACEMENTS: readonly (readonly [string, string])[] = [
  ["HX-2", "AX-2"],
  ["HX-1", "AX-1"],
  ["HX2", "AX2"],
  ["HX1", "AX1"],
  ["BMW", "Tier-1 Auto OEM"],
  ["Kawasaki", "OEM-2"],
  ["Tesla", "OEM-3"],
  ["Siemens", "OEM-4"],
  ["Maersk", "OEM-5"],
] as const;

const ROOT = process.cwd();
const SCRUB_DIR = "design";
/** Text files worth rewriting. Binaries and images are skipped by extension. */
const TEXT_EXTS = new Set([
  ".html",
  ".js",
  ".md",
  ".json",
  ".css",
  ".ts",
  ".tsx",
]);
/**
 * Gitignored design artifacts — the same set `anonymization.ts` excludes from the
 * scan. Rewriting local-only files would be pointless churn.
 */
const SKIP_DIRS = new Set([
  "uploads",
  "screenshots",
  ".thumbnail",
  "node_modules",
]);

function collect(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) collect(full, out);
    else if (TEXT_EXTS.has(extname(name))) out.push(full);
  }
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const files: string[] = [];
  collect(join(ROOT, SCRUB_DIR), files);

  const counts = new Map<string, number>();
  const changed: string[] = [];

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    let after = before;
    for (const [from, to] of REPLACEMENTS) {
      const re = new RegExp(
        `\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi",
      );
      after = after.replace(re, (m) => {
        counts.set(from, (counts.get(from) ?? 0) + 1);
        // Preserve the writer's casing. The mocks carry lowercase `kw:` search
        // strings alongside the display copy; upper-casing those would silently
        // break what each row indexes on.
        return m === m.toLowerCase() ? to.toLowerCase() : to;
      });
    }
    if (after !== before) {
      if (!dryRun) writeFileSync(file, after);
      changed.push(relative(ROOT, file));
    }
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\nSEED.6 scrub — ${files.length} file(s) scanned · ${changed.length} ${
      dryRun ? "would change" : "changed"
    } · ${total} replacement(s)\n`,
  );
  for (const [from, to] of REPLACEMENTS) {
    const n = counts.get(from) ?? 0;
    if (n) console.log(`  ${from.padEnd(10)} → ${to.padEnd(18)} ${n}`);
  }
  if (changed.length) {
    console.log("");
    for (const c of changed) console.log(`  ${c}`);
  }

  // Whatever the map did not cover, the wall still will — report it here rather
  // than letting `verify:seed-1` fail later with no hint about what to do.
  const residual = scanForMarques(ROOT, [SCRUB_DIR]);
  if (residual.length === 0) {
    console.log(
      `\nBANNED_RE over ${SCRUB_DIR}/ — 0 hits across ${BANNED_MARQUES.length} banned marques. Clean.\n`,
    );
    return;
  }
  console.log(
    `\n${residual.length} marque(s) REMAIN — no replacement is defined for these:`,
  );
  const unmapped = new Set(residual.map((h) => h.marque.toUpperCase()));
  for (const m of unmapped) console.log(`  ${m}`);
  for (const h of residual.slice(0, 20))
    console.log(`    ${h.file}:${h.line} — "${h.marque}"  ${h.text}`);
  console.log(
    "\nAdd a ruled replacement to REPLACEMENTS above (or, if the token is a generic\n" +
      "term rather than a vendor, drop it from BANNED_MARQUES) — do not guess.\n",
  );
  process.exit(1);
}

main();
