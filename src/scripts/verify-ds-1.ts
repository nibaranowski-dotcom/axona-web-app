/**
 * Verify DS.1 — imported design system reconciled + primitives + re-skin.
 * Run: pnpm verify:ds-1   (static; UI fidelity is in docs/manual-checks).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const root = process.cwd();
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

console.log("\nVerifying DS.1 — design system import + reconcile + re-skin\n");

// The imported token values that must be present in BOTH design.md and tokens.css.
const IMPORTED = [
  "#f4f3ef", // panel
  "#f7f2eb", // panel-2
  "#111111", // ink
  "#0a0a0a", // ink-strong
  "#6b6b63", // ink-muted
  "#9a9a90", // ink-faint
  "#c6f24f", // accent
  "#bce83f", // accent-hover
  "#1f9e6f", // success
  "#e9f7f0", // success-tint
];

const tokensCss = read(join(root, "packages/config/styles/tokens.css"));
const designMd = read(join(root, "design.md"));
check(
  "tokens.css has the imported DS token values",
  IMPORTED.every((h) => tokensCss.includes(h)),
);
check(
  "design.md equals the imported DS token set",
  IMPORTED.every((h) => designMd.includes(h)),
);
check(
  "fonts self-hosted (no Google CDN @import in tokens.css)",
  !/fonts\.googleapis\.com/.test(tokensCss),
);

// Tailwind mapping picks up the new tokens.
const tw = read(join(root, "packages/config/src/tailwind.ts"));
check(
  "Tailwind maps new tokens (panel-2, mono-faint, accent-hover, on-dark)",
  /var\(--panel-2\)/.test(tw) &&
    /var\(--mono-faint\)/.test(tw) &&
    /var\(--accent-hover\)/.test(tw) &&
    /var\(--on-dark\)/.test(tw),
);

// Imported source committed.
check(
  "imported source committed (design/prototypes/source/tokens + Mission Control ref)",
  existsSync(join(root, "design/prototypes/source/tokens/colors.css")) &&
    existsSync(
      join(root, "design/prototypes/source/components/core/Button.jsx"),
    ) &&
    existsSync(join(root, "design/prototypes/Mission Control.dc.html")),
);

// Primitive library.
const uiDir = join(root, "apps/web/components/ui");
for (const c of ["Button", "Badge", "Pill", "MonoChip", "Card"]) {
  check(`primitive ${c}.tsx`, existsSync(join(uiDir, `${c}.tsx`)));
}
const uiIdx = read(join(uiDir, "index.ts"));
check(
  "ui barrel exports primitives + AgentGlyph",
  /Button/.test(uiIdx) && /AgentGlyph/.test(uiIdx),
);
check(
  "AgentGlyph is the static 12-dot ring (DS coords, token fills)",
  /\[12, 4\.6\]/.test(
    read(join(root, "apps/web/components/agents/AgentGlyph.tsx")),
  ),
);

// Shell + launcher consume DS.1 primitives / tokens.
check(
  "launcher renders AppTile (dark launchpad)",
  /AppTile/.test(read(join(root, "apps/web/components/core/Launcher.tsx"))),
);
check(
  "shell module placeholder consumes a DS primitive (Card)",
  /@\/components\/ui/.test(
    read(join(root, "apps/web/app/(shell)/[module]/page.tsx")),
  ),
);
check(
  "shell uses the DS AgentGlyph",
  /AgentGlyph/.test(
    read(join(root, "apps/web/components/shell/AgentPane.tsx")),
  ),
);
check(
  "Mission Control is the root launchpad (dark, full-screen)",
  /bg-mission/.test(
    read(join(root, "apps/web/components/core/Launcher.tsx")),
  ) && existsSync(join(root, "apps/web/app/page.tsx")),
);

// Token hygiene across all app components: no raw hex, no emoji.
function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e)) out.push(p);
  }
}
const compFiles: string[] = [];
walk(join(root, "apps/web/components"), compFiles);
walk(join(root, "apps/web/app"), compFiles);
let hexHit = "";
let emojiHit = "";
for (const f of compFiles) {
  const c = read(f);
  if (!hexHit && /#[0-9a-fA-F]{3,6}\b/.test(c)) hexHit = f;
  if (!emojiHit && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(c))
    emojiHit = f;
}
check(`no raw hex in app components${hexHit ? ` (${hexHit})` : ""}`, !hexHit);
check(
  `no emoji in app components${emojiHit ? ` (${emojiHit})` : ""}`,
  !emojiHit,
);

if (failed === 0) {
  console.log(`\nPASSED — ${passed} checks`);
} else {
  console.log(`\nFAILED — ${failed} check(s) failed`);
  process.exit(1);
}
