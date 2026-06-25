/**
 * Verify FND.2 — design tokens wired into Tailwind + self-hosted fonts.
 *
 * Run: `pnpm verify:fnd-2`
 * Static checks (Node built-ins only) — no build/network needed:
 *   1. tokens.css declares every required variable (the exact design.md set).
 *   2. tokens.css holds ONLY allowed hex values (no invented colors / reds).
 *   3. Fonts: Archivo + JetBrains Mono via next/font with display:"swap".
 *   4. Tailwind theme maps the tokens 1:1 (palette replaced, fonts + radii).
 *   5. globals.css has the Tailwind layers + the dotted-grid utility.
 *   6. No raw hex anywhere in the app except tokens.css.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

const read = (rel: string): string => {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
};

// ---- 1. tokens.css declares every required variable -------------------------
const TOKENS_REL = "packages/config/styles/tokens.css";
const tokens = read(TOKENS_REL);

const requiredVars = [
  "font-sans",
  "font-mono",
  "paper",
  "panel",
  "panel-2",
  "skeleton",
  "ink",
  "ink-strong",
  "ink-muted",
  "ink-faint",
  "line",
  "line-strong",
  "line-panel",
  "accent",
  "accent-ink",
  "success",
  "success-tint",
  "on-dark-mut",
  "on-dark-faint",
  "r-pill",
  "r-btn",
  "r-card",
];
for (const v of requiredVars) {
  if (!new RegExp(`--${v.replace(/[-]/g, "\\-")}\\s*:`).test(tokens)) {
    fail(`tokens.css missing variable --${v}`);
  }
}

// brand value spot-checks
const valueChecks: Array<[string, string]> = [
  ["accent", "#c6f24f"],
  ["accent-ink", "#1b2a00"],
  ["success", "#1f9e6f"],
  ["paper", "#ffffff"],
  ["ink-strong", "#0a0a0a"],
];
for (const [name, hex] of valueChecks) {
  if (!new RegExp(`--${name}\\s*:\\s*${hex}\\b`, "i").test(tokens)) {
    fail(`tokens.css: --${name} must equal ${hex}`);
  }
}

// ---- 2. tokens.css holds only allowed hex -----------------------------------
const allowedHex = new Set(
  [
    "#ffffff",
    "#f4f3ef",
    "#eceae3",
    "#e6e4dc",
    "#1b1b1f",
    "#0a0a0a",
    "#55555f",
    "#8a8a93",
    "#e7e5df",
    "#cfccc3",
    "#d8d5cc",
    "#c6f24f",
    "#1b2a00",
    "#1f9e6f",
    "#e3f3ec",
    "#b9b9c0",
    "#6a6a73",
  ].map((h) => h.toLowerCase()),
);
const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
for (const m of tokens.matchAll(hexRe)) {
  const hex = m[0].toLowerCase();
  if (!allowedHex.has(hex)) fail(`tokens.css has non-token hex ${hex}`);
}

// ---- 3. Fonts ---------------------------------------------------------------
const fonts = read("apps/web/app/fonts.ts");
for (const needle of [
  'from "next/font/google"',
  "Archivo(",
  "JetBrains_Mono(",
  'display: "swap"',
  'variable: "--font-archivo"',
  'variable: "--font-jetbrains-mono"',
]) {
  if (!fonts.includes(needle)) fail(`fonts.ts missing: ${needle}`);
}
const layout = read("apps/web/app/layout.tsx");
for (const needle of [
  '"@axona/config/styles/tokens.css"',
  "archivo.variable",
  "jetbrainsMono.variable",
]) {
  if (!layout.includes(needle)) fail(`layout.tsx missing: ${needle}`);
}
// tokens.css must wire the semantic font vars to the next/font vars
if (!/--font-sans\s*:\s*var\(--font-archivo/.test(tokens)) {
  fail("tokens.css: --font-sans must reference var(--font-archivo)");
}
if (!/--font-mono\s*:\s*var\(--font-jetbrains-mono/.test(tokens)) {
  fail("tokens.css: --font-mono must reference var(--font-jetbrains-mono)");
}

// ---- 4. Tailwind theme maps tokens 1:1 --------------------------------------
const twMap = read("packages/config/src/tailwind.ts");
for (const needle of [
  "var(--paper)",
  "var(--panel-2)",
  "var(--ink-muted)",
  "var(--line-strong)",
  "var(--accent)",
  "var(--accent-ink)",
  "var(--success-tint)",
  "var(--font-sans)",
  "var(--font-mono)",
  "var(--r-pill)",
  "var(--r-btn)",
  "var(--r-card)",
]) {
  if (!twMap.includes(needle)) fail(`tailwind.ts missing mapping ${needle}`);
}
const twConfig = read("apps/web/tailwind.config.ts");
for (const needle of [
  'from "@axona/config"',
  "colors: axonaColors",
  "fontFamily: axonaFontFamily",
  "borderRadius: axonaBorderRadius",
]) {
  if (!twConfig.includes(needle)) fail(`tailwind.config.ts missing: ${needle}`);
}

// ---- 5. globals.css ---------------------------------------------------------
const globals = read("apps/web/app/globals.css");
for (const needle of [
  "@tailwind base",
  ".bg-dotted-grid",
  "var(--line-strong)",
]) {
  if (!globals.includes(needle)) fail(`globals.css missing: ${needle}`);
}

// ---- 6. No raw hex anywhere in the app except tokens.css --------------------
const SCAN_ROOTS = ["apps/web", "packages/config/src"];
const SCAN_EXT = /\.(tsx?|css)$/;
const TOKENS_ABS = join(root, TOKENS_REL);

function walk(dir: string, out: string[]): void {
  const abs = join(root, dir);
  if (!existsSync(abs)) return;
  for (const entry of readdirSync(abs)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".turbo")
      continue;
    const childRel = join(dir, entry);
    const childAbs = join(root, childRel);
    if (statSync(childAbs).isDirectory()) walk(childRel, out);
    else if (SCAN_EXT.test(entry)) out.push(childRel);
  }
}
const files: string[] = [];
for (const r of SCAN_ROOTS) walk(r, files);
for (const rel of files) {
  if (join(root, rel) === TOKENS_ABS) continue;
  const content = readFileSync(join(root, rel), "utf8");
  for (const m of content.matchAll(hexRe)) {
    fail(`raw hex ${m[0]} in ${relative(root, join(root, rel))} (use a token)`);
  }
}

// ---- report -----------------------------------------------------------------
if (errors.length > 0) {
  console.error(`FND.2 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `FND.2 verify OK — ${requiredVars.length} tokens, fonts wired, Tailwind mapped, ${files.length} app files hex-clean.`,
);
