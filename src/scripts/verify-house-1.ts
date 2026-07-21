/**
 * Verify HOUSE.1 — housekeeping: backlog reconciled to git log · PLM-as-module note
 * in CLAUDE.md (wedge unchanged) · verify residue self-clean · provisioning doc.
 * Pure static checks (no DB) — these are the CI gate. Run: pnpm verify:house-1
 *
 *   1. CLAUDE.md: the two `Wedge = Procurement` lines are present VERBATIM.
 *   2. CLAUDE.md: PLM-as-module + billing-meter + copy-guardrail notes added.
 *   3. backlog.md: PLM program rows + open rows present; shipped stories marked done.
 *   4. Residue fix: the self-clean guard exists + is imported by the leaking scripts.
 *   5. docs/manual-checks.md documents the local verify:all provisioning sequence.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean): void => {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? passed++ : failed++;
};

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

function run(): void {
  console.log(
    "\nVerifying HOUSE.1 — backlog · CLAUDE.md · verify residue · docs\n",
  );

  const claude = read("CLAUDE.md");
  const backlog = read("backlog.md");
  const manual = read("docs/manual-checks.md");

  // ── 1: the wedge lines stand, VERBATIM (do not change the wedge) ──
  const WEDGE_ONELINE =
    "the wedge is **agentic procurement + per-unit build genealogy**";
  const WEDGE_INVARIANT =
    "**Wedge = Procurement.** First domain co-pilot and the spine's proving ground";
  check(
    "CLAUDE.md — both `Wedge = Procurement` lines present verbatim (unchanged)",
    claude.includes(WEDGE_ONELINE) && claude.includes(WEDGE_INVARIANT),
  );

  // ── 2: the PLM-as-module decision is recorded ──
  check(
    "CLAUDE.md — PLM-as-module + billing-meter + copy-guardrail notes added",
    /PLM = a module, not a pivot/.test(claude) &&
      /`Unit` is the billing meter/.test(claude) &&
      /never lead with a category word/.test(claude) &&
      /traceability/.test(claude) &&
      /operating system for how robotics companies run/.test(claude),
  );

  // ── 3: backlog reconciled — PLM program + open rows + shipped marked done ──
  const hasRowDone = (id: string) =>
    new RegExp(
      `\\|\\s*${id.replace(".", "\\.")}\\s*\\|[^\\n]*\\|\\s*done\\s*\\|`,
    ).test(backlog);
  check(
    "backlog.md — PLM program rows present (PLM.1a/1b · PLM.2–10 · PLM.V1–V6) + stop point",
    ["PLM.1a", "PLM.1b", "PLM.2", "PLM.10", "PLM.V1", "PLM.V6"].every((id) =>
      new RegExp(`\\|\\s*${id.replace(".", "\\.")}\\s*\\|`).test(backlog),
    ) && /STOP POINT/.test(backlog),
  );
  check(
    "backlog.md — newly-tracked open rows present (AUDIT.4 · GOLIVE.1/2/3 · MEM.3 · ONT.3)",
    ["AUDIT.4", "GOLIVE.1", "GOLIVE.2", "GOLIVE.3", "MEM.3", "ONT.3"].every(
      (id) =>
        new RegExp(`\\|\\s*${id.replace(".", "\\.")}\\s*\\|`).test(backlog),
    ),
  );
  check(
    "backlog.md — shipped stories marked done (LOGIN.1 · DEMO.4 · UX.13 · CONF.1 · RBAC.5)",
    ["LOGIN.1", "DEMO.4", "UX.13", "CONF.1", "RBAC.5"].every(hasRowDone),
  );

  // ── 4: the residue self-clean guard exists + is wired into the leaking scripts ──
  const guard = read("src/scripts/lib/self-clean.ts");
  const leakers = [
    "art-2",
    "art-4",
    "rbac-4",
    "audit-1",
    "audit-3",
    "wf-1",
    "mtx-1",
  ];
  check(
    "self-clean guard exists (id-scoped restore; AuditLog rule-aware; no pattern delete)",
    /captureSeededState/.test(guard) &&
      /audit_no_delete/.test(guard) &&
      /id: \{ in: created \}/.test(guard),
  );
  check(
    "every previously-leaking verify script imports + uses the guard",
    leakers.every((f) => {
      const s = read(`src/scripts/verify-${f}.ts`);
      return (
        /import \{ captureSeededState \} from "\.\/lib\/self-clean"/.test(s) &&
        /captureSeededState\(prisma,/.test(s) &&
        /_guard\.restore\(\)/.test(s)
      );
    }),
  );

  // ── 5: provisioning sequence documented ──
  check(
    "manual-checks.md documents the local provisioning sequence (seed → blobs → embed)",
    /db:seed:blobs/.test(manual) &&
      /db:embed:backfill/.test(manual) &&
      /DATABASE_URL/.test(manual) &&
      /HOUSE\.1/.test(manual),
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
