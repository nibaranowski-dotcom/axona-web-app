/**
 * Verify MTX.1 — ask-across-files column extraction (PRD §10). Pure-logic checks
 * always run; live checks gated on DATABASE_URL. Uses FakeExtractionModel — no key,
 * deterministic, offline. Run: pnpm verify:mtx-1
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ColumnAnswer,
  FakeExtractionModel,
  LOW_CONF_FALLBACK,
  extractColumn,
} from "@axona/agents";
import type { ModelClient } from "@axona/agents";

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
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
const fake = () => new FakeExtractionModel();

async function run(): Promise<void> {
  console.log("\nVerifying MTX.1 — ask-across-files column extraction\n");

  // Static: routes + moat seams.
  await check("API routes exist (columns · rerun · matrix · delete)", () => {
    return (
      existsSync(
        join(root, "apps/web/app/api/projects/[id]/columns/route.ts"),
      ) &&
      existsSync(
        join(
          root,
          "apps/web/app/api/projects/[id]/columns/[columnId]/rerun/route.ts",
        ),
      ) &&
      existsSync(
        join(root, "apps/web/app/api/projects/[id]/matrix/route.ts"),
      ) &&
      existsSync(join(root, "apps/web/app/api/columns/[id]/route.ts"))
    );
  });
  await check(
    "POST /columns is RBAC-gated + org-scoped; answers not 'approved'",
    () => {
      const r = read("apps/web/app/api/projects/[id]/columns/route.ts");
      const extract = read("packages/agents/src/matrix/extract.ts");
      return (
        /requireRole/.test(r) &&
        /dbForOrg\(user\.orgId\)/.test(r) &&
        /enqueueMatrixExtract/.test(r) &&
        /RBAC\.4/.test(extract) &&
        /AUDIT\.3/.test(extract) &&
        /CONF\.1/.test(extract) &&
        !/approved/i.test(
          extract.replace(/approve an answer|human approves/gi, ""),
        )
      );
    },
  );

  // 1) extractColumn → valid ColumnAnswer; a forced failure → low-conf fallback.
  await check(
    "extractColumn → valid ColumnAnswer; parse failure → low-conf fallback",
    async () => {
      const good = await extractColumn(
        "ECO-318 supersedes SERVO-204. Cost +$140/unit. Owner: Priya.",
        "What is the cost impact?",
        { model: fake() },
      );
      const validGood =
        ColumnAnswer.safeParse(good).success &&
        good.confidence >= 0 &&
        good.confidence <= 1 &&
        good.citation.length > 0;
      const bad: ModelClient = {
        async createMessage() {
          return {
            stopReason: "end_turn",
            text: "NOT JSON",
            toolUses: [],
            model: "x",
          };
        },
      };
      const fb = await extractColumn("doc", "q", { model: bad });
      const isFallback =
        fb.value === LOW_CONF_FALLBACK.value && fb.confidence === 0;
      return validGood && isFallback;
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
  } else {
    const { prisma, dbForOrg } = await import("@axona/db");
    const { runColumnExtraction } = await import("@axona/agents");
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
      const db = dbForOrg(org.id);

      // 2) POST /columns fan-out: every file answered; other columns untouched.
      await check(
        "fan-out answers every file under columnId; other columns untouched",
        async () => {
          const before = await getProjectMatrix(org.id, project.id);
          const col = await db.matrixColumn.create({
            data: {
              projectId: project.id,
              question: "Key risk",
              createdBy: "verify",
            },
          });
          const res = await runColumnExtraction(
            {
              projectId: project.id,
              columnId: col.id,
              orgId: org.id,
              question: "Key risk",
            },
            { model: fake() },
          );
          const after = await getProjectMatrix(org.id, project.id);
          const everyAnswered = after.rows.every((r) => !!r.answers[col.id]);
          // an existing seeded column's answers are unchanged (idempotent merge)
          const owner = before.columns.find((c) => c.question === "Owner");
          const untouched =
            !owner ||
            after.rows.every(
              (r) =>
                r.answers[owner.id]?.value ===
                before.rows.find((b) => b.fileId === r.fileId)?.answers[
                  owner.id
                ]?.value,
            );
          await db.matrixColumn.deleteMany({ where: { id: col.id } });
          const { removeColumnAnswers } = await import("@axona/agents");
          await removeColumnAnswers(org.id, project.id, col.id);
          return res.answered === res.files && everyAnswered && untouched;
        },
      );

      // 3) empty File.text → explicit low-confidence n/a.
      await check("empty File.text → low-confidence n/a", async () => {
        const tmp = await db.file.create({
          data: {
            projectId: project.id,
            name: "__mtx_empty.txt",
            ext: "txt",
            sizeBytes: 0,
            blobKey: "verify/empty",
            type: "Data",
            text: "",
            extracted: {},
          },
        });
        const col = await db.matrixColumn.create({
          data: {
            projectId: project.id,
            question: "anything",
            createdBy: "verify",
          },
        });
        await runColumnExtraction(
          {
            projectId: project.id,
            columnId: col.id,
            orgId: org.id,
            question: "anything",
          },
          { model: fake() },
        );
        const row = (await getProjectMatrix(org.id, project.id)).rows.find(
          (r) => r.fileId === tmp.id,
        );
        const cell = row?.answers[col.id];
        const ok = cell?.value === "n/a" && (cell?.confidence ?? 1) <= 0.2;
        await db.matrixColumn.deleteMany({ where: { id: col.id } });
        await db.file.deleteMany({ where: { id: tmp.id } });
        return ok;
      });

      // 4) GET /matrix rows×columns×answers with citations; cross-org empty.
      await check(
        "matrix returns rows×columns×answers w/ citations; cross-org empty",
        async () => {
          const m = await getProjectMatrix(org.id, project.id);
          const hasCitations = m.rows.some((r) =>
            Object.values(r.answers).some((a) => a.citation.length > 0),
          );
          const cross = await getProjectMatrix(
            "org_does_not_exist",
            project.id,
          );
          return (
            m.columns.length >= 2 &&
            m.rows.length >= 2 &&
            hasCitations &&
            cross.columns.length === 0 &&
            cross.rows.length === 0
          );
        },
      );

      // 5) re-run replaces only that column; the SEEDED "Agent flag" column has a
      //    low-confidence flag (asserted without clobbering the seed — re-run a
      //    throwaway column instead).
      const { removeColumnAnswers: rm } = await import("@axona/agents");
      await check(
        "re-run replaces only that column; seeded low-confidence flag exists",
        async () => {
          const seeded = await getProjectMatrix(org.id, project.id);
          const flagCol = seeded.columns.find((c) =>
            /agent flag/i.test(c.question),
          );
          const ownerCol = seeded.columns.find((c) =>
            /owner/i.test(c.question),
          );
          const hasLowFlag =
            !!flagCol &&
            seeded.rows.some(
              (r) => (r.answers[flagCol.id]?.confidence ?? 1) < 0.4,
            );

          // a throwaway column to prove re-run is idempotent + scoped.
          const tmp = await db.matrixColumn.create({
            data: {
              projectId: project.id,
              question: "Re-run probe",
              createdBy: "verify",
            },
          });
          await runColumnExtraction(
            {
              projectId: project.id,
              columnId: tmp.id,
              orgId: org.id,
              question: "Re-run probe",
            },
            { model: fake() },
          );
          const ownerBefore = ownerCol
            ? (await getProjectMatrix(org.id, project.id)).rows.map(
                (r) => r.answers[ownerCol.id]?.value,
              )
            : [];
          await runColumnExtraction(
            {
              projectId: project.id,
              columnId: tmp.id,
              orgId: org.id,
              question: "Re-run probe",
            },
            { model: fake() },
          );
          const after = await getProjectMatrix(org.id, project.id);
          const ownerUnchanged =
            !ownerCol ||
            after.rows.every(
              (r, i) => r.answers[ownerCol.id]?.value === ownerBefore[i],
            );

          await db.matrixColumn.deleteMany({ where: { id: tmp.id } });
          await rm(org.id, project.id, tmp.id);
          return hasLowFlag && ownerUnchanged;
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
