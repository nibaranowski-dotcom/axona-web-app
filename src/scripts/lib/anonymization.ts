/**
 * SEED.1 — the single source of truth for the anonymization gate.
 *
 * The app must NEVER render a real company/person/marque anywhere — not in the
 * seed, app source, exports, or docs. This module owns the banned list and the
 * repo-wide scanner; both `verify-seed-1` (repo-wide) and `verify-demo-3` (export
 * files) import it so the two checks can never drift apart.
 *
 * This file lives under `src/scripts/` which is OUTSIDE the scanned scope
 * (apps/ · packages/ · exports/ · docs/), so the banned literals below never
 * self-trip the check.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/** Real companies / marques that must never appear in the repo. Distinctive
 *  tokens only — deliberately excludes collision-prone short forms (LG, ABB, GM,
 *  Ford, Audi) that would false-positive on Tailwind `lg:`, glyphs, or prose.
 *  SEED.6 adds "Harmonic Drive" to that carve-out: in this domain it is the
 *  GENERIC mechanism (a strain-wave gear — "left actuator harmonic drive"), not a
 *  vendor; every occurrence found was a component description. The vendor case is
 *  already covered by the seed's anonymized "Strain-Wave Gear Co". */
export const BANNED_MARQUES = [
  "BMW",
  "Kawasaki",
  "Tesla",
  "Toyota",
  "Honda",
  "Hyundai",
  "Nissan",
  "Volkswagen",
  "Mercedes",
  "Siemens",
  "Foxconn",
  "Boston Dynamics",
  "Maersk",
  "Nvidia",
  "Bosch",
  "Denso",
  "Fanuc",
  "Kuka",
  "Panasonic",
  "Samsung",
  "Stellantis",
  "Rivian",
  "General Motors",
  // PROSPECT.3 / SEED.3 — real prospects + an advisor named only in gitignored tenant
  // configs, never in committed code. Banned so a name can never re-enter a tracked
  // doc. "Helsing" · "Nomagic" · "MicrofluidX" (the prospects) + "Marcel Gordon" /
  // "Marcel" (the advisor). Standalone "Gordon" is omitted — it collides with the
  // finance "Gordon growth model". Real usage lives ONLY under the gitignored
  // `prospects/` dir (IGNORE_DIRS).
  // SEED.3 — we ban the FULL, unambiguous marque strings only. "MFX" is deliberately
  // NOT banned: it is too collision-prone (it is the story-ID prefix "MFX.1", the
  // migration/schema prefix, and reads as a generic acronym) — banning it would
  // false-positive across committed code. The distinctive "MicrofluidX" is enough.
  "Helsing",
  "Nomagic",
  "MicrofluidX",
  "Marcel Gordon",
  "Marcel",
  // SEED.4 — a real PRODUCT designation, not a company. The base seed modelled its
  // flagship as "HX-2" (with unit serials "HX2-0208", config baselines "CFG-HX2-r4.2"),
  // and because the base narrative is seeded into EVERY tenant, those strings rendered
  // live on the prospect demo orgs — a designation identifies its maker as surely as a
  // company name. Renamed to the neutral fictional "AX-2"/"AX2" across the seed, app,
  // exports, docs, verifies and specs; both spellings banned so it cannot return.
  // SEED.6 SUPERSEDES the parenthetical that used to sit here ("design/ still carries
  // it in the generated mocks — out of scope, and renaming would desync from the design
  // tool"). design/ is now BOTH scrubbed and inside the scan scope, because leaving a
  // whole directory of committed mocks unguarded is the larger risk: the ⌘K refresh
  // shipped a real marque and the scrubbed designation into a fresh export, caught only
  // by a hand scan.
  //
  // THE TRADE-OFF IS REAL AND YOU WILL MEET IT: these files are GENERATED. A re-export
  // from the design project reintroduces every marque and turns this gate red. That is
  // the intended behaviour — the gate is telling the truth — but it means the scrub has
  // to be re-run after a design sync, or the marques scrubbed at the source project.
  // BOTH generations are banned: the "HX" PREFIX is the tell, so banning only the
  // flagship would leave the previous-gen rev naming the same family. Renamed to the
  // neutral AX-1/AX-2 everywhere in scope.
  "HX-2",
  "HX2",
  "HX-1",
  "HX1",
] as const;

/** Case-insensitive, word-bounded matcher over the banned list. */
export const BANNED_RE = new RegExp(
  `\\b(${BANNED_MARQUES.map((m) =>
    m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})\\b`,
  "i",
);

// The anonymized OEM labels the narrative uses instead (kept in sync with the
// DEMO.3 deck crops: BMW → "Tier-1 Auto OEM", Kawasaki → "OEM-2", …).
export const OEM_LABELS = [
  "Tier-1 Auto OEM",
  "OEM-2",
  "OEM-3",
  "OEM-4",
  "OEM-5",
  "OEM-6",
  "OEM-7",
] as const;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".git",
  "dist",
  "build",
  "coverage",
  ".vercel",
  // PROSPECT.1 — untracked prospect-demo configs (real prospect brands live here and
  // are gitignored); never scanned by the SEED.1 marque gate.
  "prospects",
  // SEED.6 — gitignored design artifacts. The scanner walks the FILESYSTEM, not the
  // index, so once design/ came into scope these local-only dirs would fail the gate
  // on content that is not in the repo at all. Same rule as `prospects` above: the
  // wall guards what is COMMITTED. (`.gitignore` excludes uploads/ — 40MB binaries
  // plus their source notes — screenshots/ and .thumbnail.)
  "uploads",
  "screenshots",
  ".thumbnail",
]);
const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".mdx",
  ".json",
  ".html",
  ".css",
  ".sql",
  ".txt",
  ".yml",
  ".yaml",
]);

export interface MarqueHit {
  file: string; // repo-relative
  line: number; // 1-indexed
  marque: string;
  text: string; // trimmed line
}

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // dir doesn't exist — skip (scope is best-effort per repo layout)
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (TEXT_EXTS.has(extname(name))) out.push(full);
  }
}

/**
 * Scan the given directories (repo-relative) for any banned marque. Returns
 * every hit with file · line · matched marque, so a failure points at the exact
 * spot to anonymize.
 */
export function scanForMarques(root: string, dirs: string[]): MarqueHit[] {
  const hits: MarqueHit[] = [];
  const files: string[] = [];
  for (const d of dirs) walk(join(root, d), files);
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // fast reject before line-by-line work
    if (!BANNED_RE.test(content)) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const m = line.match(BANNED_RE);
      if (m) {
        hits.push({
          file: relative(root, file),
          line: i + 1,
          marque: m[1] ?? m[0],
          text: line.trim().slice(0, 160),
        });
      }
    }
  }
  return hits;
}
