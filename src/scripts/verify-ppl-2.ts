/**
 * Verify PPL.2 — People screen. Static checks always run; data checks are gated
 * on DATABASE_URL. Run: pnpm verify:ppl-2
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying PPL.2 — People screen\n");

  await check(
    "route + components exist",
    () =>
      existsSync(join(base, "app/(shell)/people/page.tsx")) &&
      ["PeopleView", "CertMatrix", "FieldTeamGrowth", "HeadcountPanel"].every(
        (c) => existsSync(join(base, `components/people/${c}.tsx`)),
      ),
  );

  await check("route renders getPeopleData", () =>
    /getPeopleData/.test(read(join(base, "app/(shell)/people/page.tsx"))),
  );

  await check("cert matrix is a tech × cert grid (signature)", () => {
    const t = read(join(base, "components/people/CertMatrix.tsx"));
    return (
      /certKeys/.test(t) && /certCell/.test(t) && /gridTemplateColumns/.test(t)
    );
  });

  await check("read-only screen — no mutations in people components", () => {
    const all = readdirSync(join(base, "components/people"))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => read(join(base, "components/people", f)))
      .join("\n");
    return !/\.(create|update|delete|upsert|updateMany|deleteMany)\(/.test(all);
  });

  await check("no red · no emoji · no raw hex in people components", () => {
    const all = readdirSync(join(base, "components/people"))
      .map((f) => read(join(base, "components/people", f)))
      .join("\n");
    return (
      !/\bred\b|#f00|ff0000/i.test(all) &&
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all) &&
      !/#[0-9a-fA-F]{3,6}\b/.test(all)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getPeopleData } = await import("../../apps/web/lib/people");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getPeopleData(org.id);
      await check("matrix renders full — ≥4 cert types × ≥5 techs", () => {
        return (
          data.certMatrix.certKeys.length >= 4 &&
          data.certMatrix.technicians.length >= 5
        );
      });
      await check(
        "Osei HV/battery expiring is the flagged dispatch gate",
        () => {
          const osei = data.certMatrix.technicians.find(
            (t) => t.name === "M. Osei",
          );
          const hv = osei?.certs.find((c) => c.key === "hvBattery");
          return hv?.expiring === true && osei!.certExpiring === true;
        },
      );
      await check(
        "matrix has a mix of states (valid / expiring / training / missing)",
        () => {
          const techs = data.certMatrix.technicians;
          const states = new Set(
            techs.flatMap((t) => t.certs.map((c) => c.state.toUpperCase())),
          );
          const someMissing = techs.some(
            (t) => t.certs.length < data.certMatrix.certKeys.length,
          );
          return (
            states.has("VALID") &&
            states.has("EXPIRING") &&
            states.has("TRAINING") &&
            someMissing
          );
        },
      );
      await check(
        "requisitions/headcount render (≥4 roles, target ≥ filled)",
        () => {
          return (
            data.requisitions.length >= 4 &&
            data.rollup.headcountTarget >= data.rollup.headcountFilled &&
            data.rollup.headcountFilled > 0
          );
        },
      );
    }
    await prisma.$disconnect();
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
