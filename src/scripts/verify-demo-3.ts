/**
 * Verify DEMO.3 — deck screen export. Pure static check (no DB, no browser).
 * Run: pnpm verify:demo-3
 *
 *   1. Both export files exist, each with a "Screen → slide map" at top and one
 *      conformant block per screen (### heading + Purpose + Crop + Caption + a
 *      self-contained ```html snippet). SEED = 6 screens, SALES = 6 screens.
 *   2. Anonymization: ZERO real-company/person hits (BMW, Kawasaki, Tesla, Maersk,
 *      Siemens, Foxconn, …) in either file.
 *   3. Every crop carries a "sample data — illustrative" chip; no emoji; no
 *      off-palette raw hex (only the five v2 tokens).
 *   4. Each HTML snippet is self-contained (inline CSS, no external deps —
 *      no <link>/<script src>/@import/fetch/http(s) asset).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BANNED_RE } from "./lib/anonymization";

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

const root = process.cwd();
const SEED = "exports/screens-export-seed.md";
const SALES = "exports/screens-export-sales.md";
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

// The five v2 tokens are the ONLY hex allowed (normalised, lowercase).
const ALLOWED_HEX = new Set(["fff", "f4f3ef", "0a0a0a", "c6f24f", "1f9e6f"]);
// Real companies/people that must never appear (anonymization gate) — the banned
// list is the shared SEED.1 source of truth (src/scripts/lib/anonymization.ts).
const BANNED = BANNED_RE;
// Emoji + dingbats (✓/✗) — but NOT the brand arrow (→, U+2192) or math ops.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function htmlBlocks(md: string): string[] {
  return [...md.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1] ?? "");
}

function offPaletteHex(md: string): string[] {
  const hits = md.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return hits.filter((h) => !ALLOWED_HEX.has(h.slice(1).toLowerCase()));
}

function auditFile(label: string, path: string, screens: number): void {
  const md = read(path);
  const blocks = htmlBlocks(md);

  check(`${label}: file exists`, () => md.length > 0);
  check(`${label}: has a "Screen → slide map" at top`, () => {
    const mapIdx = md.indexOf("Screen → slide map");
    const firstBlock = md.indexOf("### ");
    return mapIdx > 0 && mapIdx < firstBlock;
  });
  check(`${label}: ${screens} screen blocks (### headings)`, () => {
    return (md.match(/^### /gm) ?? []).length === screens;
  });
  check(`${label}: ${screens} html snippets`, () => blocks.length === screens);
  check(`${label}: every block has Purpose + Crop + Caption`, () => {
    return (
      (md.match(/\*\*Purpose on the slide:\*\*/g) ?? []).length === screens &&
      (md.match(/\*\*Crop:\*\*/g) ?? []).length === screens &&
      (md.match(/\*\*Caption \(on-slide\):\*\*/g) ?? []).length === screens
    );
  });
  check(`${label}: anonymization clean (no real companies/people)`, () => {
    return !BANNED.test(md);
  });
  check(`${label}: every crop carries the sample-data chip`, () => {
    return blocks.every((b) => /sample data — illustrative/.test(b));
  });
  check(`${label}: no emoji / dingbats`, () => !EMOJI.test(md));
  check(`${label}: only v2-token hex (no off-palette raw hex)`, () => {
    const off = offPaletteHex(md);
    if (off.length) console.log("      off-palette hex:", [...new Set(off)]);
    return off.length === 0;
  });
  check(
    `${label}: snippets are self-contained (inline CSS, no external deps)`,
    () => {
      return blocks.every(
        (b) =>
          /style=|<style/.test(b) &&
          !/<link\b/i.test(b) &&
          !/<script\b/i.test(b) &&
          !/@import\b/i.test(b) &&
          !/\bfetch\s*\(/.test(b) &&
          !/(src|href)\s*=\s*["']?https?:/i.test(b) &&
          !/url\(\s*["']?https?:/i.test(b),
      );
    },
  );
}

function run(): void {
  console.log("\nVerifying DEMO.3 — deck screen export\n");
  console.log("SEED —");
  auditFile("seed", SEED, 6);
  console.log("SALES —");
  auditFile("sales", SALES, 6);

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
