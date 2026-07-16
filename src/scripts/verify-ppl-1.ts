/**
 * Verify PPL.1 — People data/API. Static checks always run; data checks are
 * gated on DATABASE_URL. Run: pnpm verify:ppl-1
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

const root = process.cwd();
const base = join(root, "apps/web");
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");

async function run(): Promise<void> {
  console.log("\nVerifying PPL.1 — People data/API\n");

  await check(
    "routes exist (technicians / requisitions)",
    () =>
      existsSync(join(base, "app/api/people/technicians/route.ts")) &&
      existsSync(join(base, "app/api/people/requisitions/route.ts")),
  );

  const lib = read(join(base, "lib/people.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getPeopleData/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check("cert-parsing shared with FIELD.1 (lib/certs)", () => {
    const fs = read(join(base, "lib/field-service.ts"));
    return (
      existsSync(join(base, "lib/certs.ts")) &&
      /from "\.\/certs"/.test(lib) &&
      /from "\.\/certs"/.test(fs)
    );
  });
  await check("read-only — no mutations", () => {
    const routes = ["technicians", "requisitions"]
      .map((r) => read(join(base, `app/api/people/${r}/route.ts`)))
      .join("\n");
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes,
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

      await check("cert matrix — techs × certKeys grid", () => {
        const m = data.certMatrix;
        return (
          m.certKeys.length >= 1 &&
          m.technicians.length >= 2 &&
          m.technicians.every((t) => Array.isArray(t.certs))
        );
      });
      await check(
        "M. Osei's HV/battery cert is EXPIRING (dispatch gate)",
        () => {
          const osei = data.certMatrix.technicians.find(
            (t) => t.name === "M. Osei",
          );
          const hv = osei?.certs.find((c) => /hvBattery/i.test(c.key));
          return (
            !!hv &&
            hv.expiring === true &&
            hv.state.toUpperCase() === "EXPIRING" &&
            osei!.certExpiring === true
          );
        },
      );
      await check("requisitions — headcount filled/target with open", () => {
        return (
          data.requisitions.length >= 2 &&
          data.requisitions.every(
            (r) =>
              typeof r.filled === "number" &&
              typeof r.target === "number" &&
              r.open === Math.max(0, r.target - r.filled),
          )
        );
      });
      await check(
        "rollup (certs expiring / headcount / field-team size)",
        () => {
          const r = data.rollup;
          return (
            r.certsExpiring >= 1 &&
            r.headcountTarget >= r.headcountFilled &&
            r.fieldTeamSize === data.fieldTeam.length &&
            r.fieldTeamSize >= 2
          );
        },
      );
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getPeopleData("org_does_not_exist");
        return (
          empty.certMatrix.technicians.length === 0 &&
          empty.requisitions.length === 0 &&
          empty.rollup.fieldTeamSize === 0
        );
      });
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
