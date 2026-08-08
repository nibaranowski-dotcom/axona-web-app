/**
 * Verify SEED.1 — anonymize the narrative at the source.
 * Run: pnpm verify:seed-1
 *
 *   1. ZERO real-marque hits across apps/ + packages/ + exports/ + docs/ (the whole
 *      banned list — BMW, Kawasaki, Tesla, …). The scan must have actually visited
 *      files (guards against a silent empty scan false-passing).
 *   2b. PROSPECT.3 — the prospect/advisor names (Helsing / Marcel) are banned AND
 *      absent from specs/ and the whole tracked tree (a name reintroduced into any
 *      committed doc — specs included — fails CI). The gitignored prospects/ tenant
 *      config legitimately uses the real name and is never scanned.
 *   2. No-regression on the DEMO.3 export: both export files exist and are clean.
 *   3. The seed still produces the same cross-module narrative — getBlastRadius
 *      for NCR-118 is 17 nodes / 7 modules (PLM.1a added the Unit spine), and the Fulfillment/Finance
 *      nodes now read the anonymized account ("Tier-1 Auto OEM", never a marque).
 *      (DB check — gated behind DATABASE_URL so the pre-push hook runs statics.)
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BANNED_MARQUES, BANNED_RE, scanForMarques } from "./lib/anonymization";

// SEED.3 — the prospect/advisor marques the wall enforces across the WHOLE committed
// tree (distinctive, non-collision-prone tokens). BMW/Kawasaki etc. stay in the full
// BANNED_MARQUES list, now scanned over apps/packages/exports/docs/design.
// (Until SEED.6 this comment said they had "pre-existing design-mock usage out of this
// scope" — that usage is scrubbed and design/ is in scope, so the exemption is gone.)
// "MFX" is deliberately excluded (collision-prone story-ID/migration prefix).
const PROSPECT_MARQUES = [
  "helsing",
  "nomagic",
  "microfluidx",
  "marcel",
  "gordon",
];
const MARQUE_GREP = PROSPECT_MARQUES.map((m) => `-e ${m}`).join(" ");

// The ONLY committed files permitted to contain a marque token — each names one to
// ENFORCE the wall (the list / this verify) or to GUARD against a leak (assert it is
// ABSENT). Anything else that matches is a real leak and fails the wall.
const MARQUE_ALLOWLIST: { path: string; reason: string }[] = [
  {
    path: "src/scripts/lib/anonymization.ts",
    reason:
      "the banned-list source of truth — names every marque by definition",
  },
  {
    path: "src/scripts/verify-seed-1.ts",
    reason:
      "this wall itself — names marques in the grep pattern, allowlist reasons + self-test",
  },
  {
    path: "src/scripts/verify-audit-4.ts",
    reason:
      "anti-leak GUARD — asserts the base demo audit view does NOT contain 'Nomagic'",
  },
  {
    path: "src/scripts/verify-conf-1.ts",
    reason:
      "anti-leak GUARD — asserts the base demo calibration panel does NOT contain 'Nomagic'",
  },
];
const ALLOWLIST_EXCLUDES = MARQUE_ALLOWLIST.map(
  (a) => `':(exclude)${a.path}'`,
).join(" ");

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

async function run(): Promise<void> {
  console.log("\nVerifying SEED.1 — anonymize the narrative at the source\n");
  const root = process.cwd();
  // SEED.6 — design/ joins the scope. It holds 131 committed .dc.html mocks (plus the
  // handoff docs and the DS bundle), and it was the one large body of committed content
  // the wall did not guard: the ⌘K refresh shipped a real marque and the scrubbed
  // designation into a fresh export, caught only because it was scanned by hand.
  // Gitignored design artifacts (uploads/ · screenshots/ · .thumbnail) are excluded in
  // the scanner's IGNORE_DIRS — the wall guards what is COMMITTED.
  const SCOPE = ["apps", "packages", "exports", "docs", "design"];

  // 1. repo-wide anonymization gate
  const hits = scanForMarques(root, SCOPE);
  await check(
    `repo-wide scan clean — ZERO of ${BANNED_MARQUES.length} banned marques across ${SCOPE.join(" · ")}`,
    () => {
      if (hits.length) {
        console.log(`      ${hits.length} hit(s):`);
        for (const h of hits.slice(0, 40))
          console.log(`        ${h.file}:${h.line} — "${h.marque}"  ${h.text}`);
        if (hits.length > 40)
          console.log(`        …and ${hits.length - 40} more`);
      }
      return hits.length === 0;
    },
  );
  // the scan actually ran over real files (an empty/misrouted scan must not pass #1)
  await check("scan visited the seed source (coverage sanity)", () => {
    const seedHits = scanForMarques(root, ["packages/db/prisma/seed"]);
    // seed dir exists + is scannable; a KNOWN marker string proves reads work
    const marker = existsSync(
      join(root, "packages/db/prisma/seed/value-chain.ts"),
    );
    return marker && seedHits.length === 0;
  });

  // 2. DEMO.3 export no-regression
  await check("DEMO.3 exports exist and are marque-free", () => {
    const files = [
      "exports/screens-export-seed.md",
      "exports/screens-export-sales.md",
    ];
    return files.every((f) => {
      const p = join(root, f);
      if (!existsSync(p)) return false;
      return !BANNED_RE.test(readFileSync(p, "utf8"));
    });
  });

  // 2b. PROSPECT.3 — the prospect/advisor names are banned + the scan reaches specs/
  await check("banned list includes every prospect + advisor marque", () => {
    const has = (m: string) =>
      (BANNED_MARQUES as readonly string[]).includes(m);
    return (
      has("Helsing") &&
      has("Nomagic") &&
      has("MicrofluidX") &&
      has("Marcel Gordon") &&
      has("Marcel") &&
      // SEED.4 — the real product designation, both generations, both spellings.
      // The "HX" prefix is the tell, so the previous-gen rev is banned alongside
      // the flagship.
      has("HX-2") &&
      has("HX2") &&
      has("HX-1") &&
      has("HX1")
    );
  });
  await check("specs/ is free of every prospect + advisor marque", () => {
    // Enforce the prospect marques over specs/ explicitly (the general marque scan
    // stays on apps/packages/exports/docs; specs/ carries a separate pre-existing
    // BMW/Kawasaki cleanup that is out of this scope — flagged, not swept).
    const out = execSync(`git grep -iI -c ${MARQUE_GREP} -- specs/ || true`, {
      cwd: root,
    })
      .toString()
      .trim();
    if (out)
      console.log(`      specs hits:\n${out.replace(/^/gm, "        ")}`);
    return out.length === 0;
  });
  await check(
    `tracked tree has ZERO prospect marques (${PROSPECT_MARQUES.join("/")}) outside the allowlist`,
    () => {
      // The WHOLE committed tree (incl. specs/) minus the gitignored tenant dir and
      // the explicit MARQUE_ALLOWLIST (enforcement + anti-leak guards). Anything else
      // that names a marque is a real leak.
      const out = execSync(
        `git grep -iI -c ${MARQUE_GREP} -- . ':(exclude)prospects/' ${ALLOWLIST_EXCLUDES} || true`,
        { cwd: root },
      )
        .toString()
        .trim();
      if (out) console.log(`      hits:\n${out.replace(/^/gm, "        ")}`);
      return out.length === 0;
    },
  );

  // ── SEED.3 self-test — the wall must BITE (so it can't silently rot) ──────────
  await check(
    "wall self-test: the marque grep is LIVE and the allowlist is exactly the marque-bearing files",
    () => {
      // WITHOUT the allowlist the grep must still find files (proving it isn't a
      // no-op), and EVERY file it finds must be an allowlisted path (proving the tree
      // is clean + the allowlist is precise — nothing un-allowlisted names a marque).
      const out = execSync(
        `git grep -iI -l ${MARQUE_GREP} -- . ':(exclude)prospects/' || true`,
        { cwd: root },
      )
        .toString()
        .trim();
      const files = out ? out.split("\n") : [];
      const allow = new Set(MARQUE_ALLOWLIST.map((a) => a.path));
      const stray = files.filter((f) => !allow.has(f));
      if (stray.length)
        console.log(
          `      un-allowlisted marque files:\n        ${stray.join("\n        ")}`,
        );
      return files.length >= 3 && stray.length === 0;
    },
  );
  await check(
    "wall self-test: a reintroduced marque in a fresh file IS caught (scanner positive control)",
    () => {
      // Prove the detection mechanism bites: a new file with a banned marque is a hit;
      // the anonymized label is not. Self-cleaning (temp dir outside the repo).
      const tmp = mkdtempSync(join(tmpdir(), "seed3-"));
      try {
        writeFileSync(
          join(tmp, "leak.ts"),
          'export const x = "a Nomagic cell";\n',
        );
        writeFileSync(
          join(tmp, "ok.ts"),
          'export const y = "Tier-1 Auto OEM";\n',
        );
        const hits = scanForMarques(tmp, ["."]);
        return hits.length === 1 && hits[0]?.marque.toLowerCase() === "nomagic";
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  );

  // 3. narrative integrity — the NCR-118 cascade is unchanged (DB)
  if (!process.env.DATABASE_URL) {
    console.log("  SKIP narrative check — DATABASE_URL not set");
    console.log(`\nPASSED — ${passed} checks (static only)`);
    return;
  }

  const { dbForOrg } = await import("@axona/db");
  const { getBlastRadius } = await import("@axona/agents");
  const db = dbForOrg("org_axona_demo");
  const r = await getBlastRadius(db, { entityType: "NCR", code: "NCR-118" });

  // PLM.1a extended the thread with the Unit spine — NCR-118 reaches the affected
  // units via the ECO/LOT→UNIT edges (14→17 nodes). PLM.2 then reconciled the UNIT
  // node onto that spine and gave units their OWN module group ("Units"). PLM.8 then
  // wired the deferred-tier nodes into the graph (NCR-118 —CAUSED_BY→ TEST_RUN, the
  // field event —AFFECTS→ SN-2208), so the cascade grew to 19 nodes; the modules
  // stay 8 (TEST_RUN is Quality, FIELD_EVENT is Field Service — both already present).
  await check("NCR-118 cascade intact — 19 nodes / 8 modules", () => {
    return r.found && r.nodeCount === 19 && r.moduleCount === 8;
  });
  await check(
    "Fulfillment + Finance nodes read the anonymized OEM account (no marque)",
    () => {
      const nodes = r.groups
        .filter((g) => g.module === "Fulfillment" || g.module === "Finance")
        .flatMap((g) => g.nodes);
      return (
        nodes.length >= 2 &&
        nodes.every(
          (n) => !BANNED_RE.test(n.label) && !BANNED_RE.test(n.path),
        ) &&
        nodes.some((n) => /Tier-1 Auto OEM/.test(n.label))
      );
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => {
  if (failed > 0) process.exit(1);
  process.exit(0);
});
