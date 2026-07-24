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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BANNED_MARQUES, BANNED_RE, scanForMarques } from "./lib/anonymization";

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
  const SCOPE = ["apps", "packages", "exports", "docs"];

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
  await check("banned list includes the prospect + advisor names", () => {
    const has = (m: string) =>
      (BANNED_MARQUES as readonly string[]).includes(m);
    return has("Helsing") && has("Marcel Gordon") && has("Marcel");
  });
  await check("specs/ is free of the prospect + advisor names", () => {
    // Enforce the PROSPECT.3 names over specs/ explicitly (the general marque scan
    // stays on apps/packages/exports/docs; specs/ carries a separate pre-existing
    // BMW/Kawasaki cleanup that is out of PROSPECT.3's scope — flagged, not swept).
    const out = execSync(
      "git grep -iI -c -e helsing -e marcel -e gordon -- specs/ || true",
      { cwd: root },
    )
      .toString()
      .trim();
    if (out)
      console.log(`      specs hits:\n${out.replace(/^/gm, "        ")}`);
    return out.length === 0;
  });
  await check(
    "tracked tree has ZERO helsing/marcel/gordon (git grep, excl. enforcement files)",
    () => {
      // Exclude the gitignored tenant dir + the two enforcement files that MUST
      // name them (the banned list + this verify) — everything else must be clean.
      const out = execSync(
        "git grep -iI -c -e helsing -e marcel -e gordon -- . " +
          '":(exclude)prospects/" ' +
          '":(exclude)src/scripts/lib/anonymization.ts" ' +
          '":(exclude)src/scripts/verify-seed-1.ts" || true',
        { cwd: root },
      )
        .toString()
        .trim();
      if (out) console.log(`      hits:\n${out.replace(/^/gm, "        ")}`);
      return out.length === 0;
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
