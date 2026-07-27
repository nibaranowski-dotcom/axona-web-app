/**
 * Verify SEAMS.1 — Record-layer seams for the up-stack (design the seams, build
 * only Record). Run: pnpm verify:seams-1
 *
 *   1. CLAUDE.md carries the Record→Sense→Predict→Act north star + "build only
 *      Record now"; the Procurement WEDGE line is unchanged (both present).
 *   2. product-north-star.md + the architecture-learnings.md axis-mapping line exist.
 *   3. Seam (a): the StationSignal/StationEvent typed interface + a `/// SENSE`
 *      pointer on the Record spine — INTERFACE ONLY (no table/model/ingest).
 *   4. Seam (b): unitOutcomes(db, SN-2208) returns the typed per-unit substrate
 *      (test results + NCR-118 rootCause + field events), org-scoped (a second org
 *      resolves zero), READ-ONLY (no mutation path in the helper).
 *   5. Non-breaking: nothing Sense/Predict/Act was built (no new model/table);
 *      migrate status clean is asserted by the CI gate + verify:all.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const DEMO = "org_axona_demo";
const SECOND = "org_isolation_test";

async function run(): Promise<void> {
  console.log("\nVerifying SEAMS.1 — Record-layer seams for the up-stack\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const claude = read("CLAUDE.md");
  const northStar = read("specs/product-north-star.md");
  const archLearnings = read("specs/architecture-learnings.md");
  const schema = read("packages/db/prisma/schema.prisma");
  const sense = read("packages/db/src/plm/sense-seam.ts");
  const outcomes = read("packages/db/src/plm/outcomes.ts");

  // ── 1: CLAUDE.md north star + guardrail + the wedge line unchanged ──
  await check(
    "CLAUDE.md carries the Record→Sense→Predict→Act north star + 'build only Record now'",
    () => {
      return (
        /Record\s*→\s*Sense\s*→\s*Predict\s*→\s*Act/.test(claude) &&
        /build only Record now/i.test(claude) &&
        /propose→approve→audit runtime IS the path to Act/i.test(claude)
      );
    },
  );
  await check(
    "the Procurement WEDGE line is unchanged (both wedge refs present)",
    () => {
      return (
        /the wedge is \*\*agentic procurement \+ per-unit build genealogy\*\*/.test(
          claude,
        ) && /\*\*Wedge = Procurement\.\*\* First domain co-pilot/.test(claude)
      );
    },
  );

  // ── 2: the fuller narrative + the axis-mapping line ──
  await check("product-north-star.md exists (the fuller narrative)", () => {
    return (
      northStar.length > 0 &&
      /Record\s*→\s*Sense\s*→\s*Predict\s*→\s*Act/.test(northStar) &&
      /build \*\*only Record\*\*|build only Record/i.test(northStar)
    );
  });
  await check(
    "architecture-learnings.md maps the data-maturity axis onto L1–L4",
    () => {
      return (
        /data-maturity/i.test(archLearnings) &&
        /Record\s*→\s*Sense\s*→\s*Predict\s*→\s*Act/.test(archLearnings) &&
        /L1[–-]L4|software-layer/i.test(archLearnings)
      );
    },
  );

  // ── 3: Seam (a) — the typed interface + /// SENSE pointer, NOT a pipeline ──
  await check(
    "Seam (a): StationSignal/StationEvent typed interface exists (unitId?·station·ts·metric/value·eventType/payload)",
    () => {
      return (
        /export interface StationSignal \{/.test(sense) &&
        /export interface StationEvent \{/.test(sense) &&
        /station: string/.test(sense) &&
        /metric: string/.test(sense) &&
        /eventType: string/.test(sense) &&
        /export type StationInput =/.test(sense)
      );
    },
  );
  await check(
    "Seam (a): a `/// SENSE` pointer sits on the Record spine (Unit)",
    () => {
      // the pointer is on the Unit model block, above `model Unit {`
      const unitBlock = schema.slice(
        Math.max(0, schema.indexOf("model Unit {") - 700),
        schema.indexOf("model Unit {"),
      );
      return /\/\/\/ SENSE/.test(unitBlock) && /sense-seam/.test(unitBlock);
    },
  );
  await check(
    "Seam (a) is INTERFACE ONLY — types, no table/pipeline (runtime code)",
    () => {
      // no speculative Station* table in the schema, and the seam file is types-only:
      // no executable runtime (no function/await, no db/prisma calls) — a contract, not
      // a pipeline. ("ingest" appears only in comments pointing at SENSE.1.)
      return (
        !/model\s+Station/.test(schema) &&
        !/\bfunction\b/.test(sense) &&
        !/\bawait\b/.test(sense) &&
        !/\b(prisma|db)\.\w/.test(sense)
      );
    },
  );

  // ── 5 (static): nothing Sense/Predict/Act was actually built ──
  await check("no Sense/Predict/Act module or capture table added", () => {
    return (
      !/model\s+StationSignal|model\s+StationEvent|model\s+UnitOutcome|model\s+Prediction/.test(
        schema,
      ) && !/moduleKey: "sense"|moduleKey: "predict"/.test(schema)
    );
  });
  await check(
    "Seam (b): unitOutcomes is READ-ONLY (no mutation path in the helper)",
    () => {
      // the helper reads (findMany) only — no write ops
      const body = outcomes.slice(
        outcomes.indexOf("export async function unitOutcomes"),
      );
      return (
        /findMany/.test(body) &&
        !/\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(/.test(
          body,
        )
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set");
    if (failed === 0) console.log(`\nPASSED — ${passed} checks (static only)`);
    else {
      console.log(`\nFAILED — ${failed} check(s) failed`);
      process.exit(1);
    }
    return;
  }

  const { prisma, dbForOrg, unitOutcomes } = await import("@axona/db");

  // ── 4: the Predict substrate for SN-2208 (test results + NCR-118 rootCause +
  //      field events), org-scoped; a second org resolves zero ──
  const db = dbForOrg(DEMO);
  const unit = await db.unit.findFirst({ where: { serial: "SN-2208" } });
  await check("SN-2208 unit exists (the demo thread's hero)", () => !!unit);

  if (unit) {
    const outs = await unitOutcomes(db, unit.id);
    await check(
      "unitOutcomes(SN-2208) yields test-result + NCR + field-event labels",
      () => {
        const hasTest = outs.some(
          (o) => o.kind === "test" && /pass|fail/.test(o.outcome),
        );
        const ncr = outs.find((o) => o.kind === "ncr" && o.code === "NCR-118");
        const hasField = outs.some((o) => o.kind === "field_event");
        return (
          outs.length >= 4 &&
          hasTest &&
          // NCR-118's ROOT CAUSE is the label; the frozen config is the join ref
          !!ncr &&
          ncr.outcome === "component" &&
          typeof ncr.config === "string" &&
          hasField &&
          // every outcome carries a typed source ref (sourceType/sourceId)
          outs.every(
            (o) => !!o.sourceType && !!o.sourceId && typeof o.kind === "string",
          )
        );
      },
    );
    await check(
      "org-scoped: a second org resolves ZERO outcomes for the demo unit",
      async () => {
        const other = await unitOutcomes(dbForOrg(SECOND), unit.id);
        return other.length === 0;
      },
    );
  }

  await prisma.$disconnect();

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
