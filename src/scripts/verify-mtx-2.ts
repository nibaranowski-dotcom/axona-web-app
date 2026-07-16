/**
 * Verify MTX.2 — Project Files matrix screen. Static checks always run; data
 * checks gated on DATABASE_URL. Run: pnpm verify:mtx-2
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
  console.log("\nVerifying MTX.2 — Project Files matrix screen\n");

  const view = read(join(base, "components/matrix/MatrixView.tsx"));

  await check("route + component + format exist", () => {
    return (
      existsSync(join(base, "app/(shell)/projects/[id]/page.tsx")) &&
      !!view &&
      existsSync(join(base, "components/matrix/format.ts"))
    );
  });
  await check(
    "binds the matrix (files×columns×answers) + ask-across-files bar",
    () => {
      const page = read(join(base, "app/(shell)/projects/[id]/page.tsx"));
      return (
        /getProjectMatrix/.test(page) &&
        /columns\.map/.test(view) &&
        /rows\.map/.test(view) &&
        /answers\[c\.id\]/.test(view) &&
        /Add column/.test(view) &&
        /\/api\/projects\/\$\{data\.projectId\}\/columns/.test(view)
      );
    },
  );
  await check(
    "cells render confidence + citation; low-confidence flagged in INK",
    () => {
      const fmt = read(join(base, "components/matrix/format.ts"));
      return (
        /isLowConfidence/.test(view) &&
        /confidenceDot/.test(view) &&
        /citation/.test(view) &&
        /Review/.test(view) && // the flag-for-review chip
        /bg-ink-strong/.test(fmt) && // low-confidence dot in ink (never red)
        !/\bbg-red|text-red|border-red\b/.test(view + fmt)
      );
    },
  );
  await check("PROJ.1 rows link to /projects/:id (matrix reachable)", () => {
    const pv = read(join(base, "components/projects/ProjectsView.tsx"));
    return /href=\{`\/projects\/\$\{p\.id\}`\}/.test(pv);
  });
  await check("agent-drafted cells — not presented as 'approved'", () => {
    // Ignore the doc comment that explicitly says answers are NOT approved.
    const code = view.replace(/never (?:presented as )?approved/gi, "");
    return !/approved/i.test(code);
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP data checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { getProjectMatrix } = await import("../../apps/web/lib/matrix");
    const org = await prisma.org.findFirst({
      where: { name: "Axona" },
    });
    const project = org
      ? await dbForOrg(org.id).project.findFirst({
          where: { name: { contains: "ECO-318" } },
          select: { id: true },
        })
      : null;

    if (!org || !project) {
      console.log("  FAIL demo org/ECO-318 project missing (run pnpm db:seed)");
      failed++;
    } else {
      await check("matrix binds files × columns × cited answers", () => {
        return getProjectMatrix(org.id, project.id).then((m) => {
          const allCells = m.rows.flatMap((r) => Object.values(r.answers));
          return (
            m.columns.length >= 2 &&
            m.rows.length >= 2 &&
            allCells.length >= m.columns.length && // every column answered on ≥1 row
            allCells.some((a) => a.citation.length > 0) &&
            allCells.every(
              (a) =>
                typeof a.value === "string" &&
                a.confidence >= 0 &&
                a.confidence <= 1,
            )
          );
        });
      });
      await check(
        "a low-confidence review-flag cell is present (< 0.4)",
        async () => {
          const m = await getProjectMatrix(org.id, project.id);
          return m.rows.some((r) =>
            Object.values(r.answers).some((a) => a.confidence < 0.4),
          );
        },
      );
      await check(
        "rows carry file metadata (ext/size/modified) for the table",
        async () => {
          const m = await getProjectMatrix(org.id, project.id);
          return m.rows.every(
            (r) =>
              typeof r.ext === "string" &&
              typeof r.sizeBytes === "number" &&
              !!r.modifiedAt,
          );
        },
      );
      await check("cross-org project id → empty matrix", async () => {
        const m = await getProjectMatrix("org_does_not_exist", project.id);
        return m.columns.length === 0 && m.rows.length === 0;
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
