/**
 * Verify PROJ.1 — Projects read model + screen. Static checks always run; data
 * checks are gated on DATABASE_URL. Run: pnpm verify:proj-1
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
  console.log("\nVerifying PROJ.1 — Projects read model + screen\n");

  await check(
    "route + component + routes exist",
    () =>
      existsSync(join(base, "app/(shell)/projects/page.tsx")) &&
      existsSync(join(base, "components/projects/ProjectsView.tsx")) &&
      existsSync(join(base, "app/api/projects/route.ts")) &&
      existsSync(join(base, "app/api/projects/summary/route.ts")),
  );

  const lib = read(join(base, "lib/projects.ts"));
  await check(
    "lib exists, org-scoped (dbForOrg) + paginated (FND.11)",
    () =>
      /getProjectsData/.test(lib) &&
      /listProjects/.test(lib) &&
      /dbForOrg/.test(lib) &&
      /paginateArgs/.test(lib) &&
      /pageResult/.test(lib),
  );
  await check(
    "moat: RBAC.4 + AUDIT.3 seams; file matrix deferred to MTX.2",
    () => /RBAC\.4/.test(lib) && /AUDIT\.3/.test(lib) && /MTX\.2/.test(lib),
  );
  await check("read-only — no mutations", () => {
    const routes = ["route.ts", "summary/route.ts"]
      .map((r) => read(join(base, `app/api/projects/${r}`)))
      .join("\n");
    const view = read(join(base, "components/projects/ProjectsView.tsx"));
    return !/\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\(/.test(
      lib + routes + view,
    );
  });
  await check("GA.1 Axona agent in the pane (Core module → no roster)", () => {
    // /projects is a Core module; the shared pane routes Core → the Axona agent
    // (GA.1). Assert we did NOT add a projects-module roster (would override it).
    const agentsSeed = read(join(root, "packages/db/prisma/seed/agents.ts"));
    return !/\n\s*projects:\s*{/.test(agentsSeed);
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma } = await import("@axona/db");
    const { getProjectsData, listProjects } =
      await import("../../apps/web/lib/projects");
    const org = await prisma.org.findFirst({
      where: { name: "Axona Demo Co" },
    });
    if (!org) {
      console.log("  FAIL demo org not seeded (run pnpm db:seed)");
      failed++;
    } else {
      const data = await getProjectsData(org.id);

      await check("groups module-separated (multiple modules)", () => {
        return (
          data.groups.length >= 4 &&
          data.groups.every((g) => g.projects.length >= 1 && !!g.module) &&
          data.rollup.total >= 10 &&
          data.rollup.modules >= 4
        );
      });
      await check(
        "member breakdown + file count + status + activity bind",
        () => {
          const all = data.groups.flatMap((g) => g.projects);
          return (
            all.every(
              (p) =>
                typeof p.agentCount === "number" &&
                Array.isArray(p.humanMembers) &&
                typeof p.fileCount === "number" &&
                !!p.updatedAt,
            ) &&
            all.some((p) => p.agentCount >= 1 && p.humanMembers.length >= 1) &&
            all.some((p) => p.fileCount >= 1)
          );
        },
      );
      await check(
        "rollup binds (files total, needs-attention, modules)",
        () => {
          const all = data.groups.flatMap((g) => g.projects);
          return (
            data.rollup.files === all.reduce((n, p) => n + p.fileCount, 0) &&
            data.rollup.needsAttention ===
              all.filter((p) => p.needsAttention).length &&
            data.rollup.files > 0
          );
        },
      );
      await check(
        "cross-module through-line project present (ECO-318/NCR-118)",
        () => {
          const all = data.groups.flatMap((g) => g.projects);
          return all.some((p) => /ECO-318|NCR-118|DLV-3312|SERVO/.test(p.name));
        },
      );
      await check("listProjects paginates + filters by module", async () => {
        const page = await listProjects(org.id, { take: 5 });
        const eng = await listProjects(org.id, { moduleKey: "engineering" });
        return (
          page.items.length <= 5 &&
          "nextCursor" in page &&
          eng.items.every((p) => p.moduleKey === "engineering") &&
          eng.items.length >= 1
        );
      });
      await check("org isolation — unknown org returns nothing", async () => {
        const empty = await getProjectsData("org_does_not_exist");
        return empty.groups.length === 0 && empty.rollup.total === 0;
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
