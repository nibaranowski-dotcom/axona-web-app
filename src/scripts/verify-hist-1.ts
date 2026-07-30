/**
 * Verify HIST.1 — per-record audited change history (surfaces AUDIT.1).
 * Static checks always run; DB checks gate on DATABASE_URL. Run: pnpm verify:hist-1
 *
 *   1. BUILD-ON-TOP: getRecordHistory is the SAME reader (getAuditTrail) scoped by
 *      target — no new audit store, no second reader, no write path; the shared
 *      confidence/actor rendering (audit-parts) is used by BOTH AuditView + the
 *      RecordHistory timeline (no fork). verify:audit-1/2/3/4 stay green.
 *   2. getRecordHistory returns ECO-318's seeded trail newest-first, org-scoped
 *      (a 2nd org → 0).
 *   3. Agent entries carry the AUDIT.3 model + CONF.1 confidence; before→after
 *      renders from inputs/output.
 *   4. The <RecordHistory> panel is wired on ≥5 detail views alongside LINK.1;
 *      empty state on a record with no entries.
 *   5. READ-ONLY: HIST.1 adds no write/mutation path to the log.
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
  console.log("\nVerifying HIST.1 — per-record audited change history\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";
  const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

  const lib = read("apps/web/lib/audit-trail.ts");
  const parts = read("apps/web/components/audit/audit-parts.tsx");
  const view = read("apps/web/components/audit/AuditView.tsx");
  const panel = read("apps/web/components/audit/RecordHistory.tsx");

  // ── 1 (static): BUILD-ON-TOP — same reader, no second store/reader/writer ──
  await check(
    "getRecordHistory reuses the existing reader (delegates to getAuditTrail; targetId scopes it)",
    () => {
      return (
        /export async function getRecordHistory/.test(lib) &&
        /return getAuditTrail\(/.test(lib) && // delegates — same query path
        /f\.targetId \?/.test(lib) // whereFrom extended with targetId
      );
    },
  );
  await check(
    "no second reader: the HIST.1 functions add NO auditLog query — they delegate to getAuditTrail",
    () => {
      // The history functions (getRecordHistory + recordHistoryFor) must contain
      // zero direct DB reads — they reuse getAuditTrail (the ONE entries reader).
      const histBlock = lib.slice(
        lib.indexOf("export async function getRecordHistory"),
        lib.indexOf("export async function getCalibration"),
      );
      return (
        histBlock.length > 0 &&
        count(histBlock, /auditLog\.findMany/g) === 0 && // no new reader
        /return getAuditTrail\(/.test(histBlock) && // reuse the reader
        /return getRecordHistory\(/.test(histBlock) // recordHistoryFor delegates too
      );
    },
  );
  await check(
    "READ-ONLY: no write/mutation path added (no writeAudit() call / auditLog mutation in HIST.1 code)",
    () => {
      // match a CALL `writeAudit(` (not the word in a comment) + any auditLog mutation.
      const io =
        /writeAudit\(|auditLog\.(create|update|updateMany|delete|deleteMany|upsert)/;
      return !io.test(panel) && !io.test(parts) && !io.test(lib);
    },
  );
  await check(
    "no fork: the CONF.1 confidence badge + actor avatar are shared (AuditView + RecordHistory use audit-parts)",
    () => {
      return (
        /ConfidenceCell/.test(parts) &&
        /ActorAvatar/.test(parts) &&
        /from "\.\/audit-parts"/.test(view) && // AuditView delegates
        /from "\.\/audit-parts"/.test(panel) && // RecordHistory reuses the same
        /ConfidenceCell/.test(panel)
      );
    },
  );
  await check(
    "RecordHistory renders before→after + an empty state · v2 tokens",
    () => {
      return (
        /before → after/.test(panel) &&
        /e\.inputs/.test(panel) &&
        /e\.output/.test(panel) &&
        /No changes recorded for this record yet/.test(panel) &&
        !/#[0-9a-fA-F]{6}\b/.test(panel)
      );
    },
  );

  // ── 4 (static): wired on ≥5 detail views alongside LINK.1 ──
  await check(
    "the <RecordHistory> panel is on ≥5 detail views + pages load it",
    () => {
      const views = [
        "apps/web/components/units/UnitView.tsx",
        "apps/web/components/rca/RcaView.tsx",
        "apps/web/components/changes/ChangeOrderView.tsx",
        "apps/web/components/configurations/ConfigurationDetailView.tsx",
        "apps/web/components/tests/TestRunView.tsx",
      ];
      const pages = [
        "apps/web/app/(shell)/units/[serial]/page.tsx",
        "apps/web/app/(shell)/rca/[ncrCode]/page.tsx",
        "apps/web/app/(shell)/changes/[code]/page.tsx",
        "apps/web/app/(shell)/configurations/[code]/page.tsx",
        "apps/web/app/(shell)/tests/[code]/page.tsx",
      ];
      const viewsOk = views.every(
        (f) =>
          /<RecordHistory/.test(read(f)) && /ConnectedObjects/.test(read(f)), // sibling of LINK.1
      );
      const pagesOk = pages.every((f) => /recordHistoryFor\(/.test(read(f)));
      return viewsOk && pagesOk;
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("\n  SKIP data checks — DATABASE_URL not set (static only)");
    finish();
    return;
  }

  const { dbForOrg } = await import("@axona/db");
  const { getRecordHistory, recordHistoryFor } =
    await import("../../apps/web/lib/audit-trail");

  // ── 2: ECO-318's seeded trail — newest-first, org-scoped ──
  await check(
    "getRecordHistory(ECO-318) returns its seeded trail, newest-first, org-scoped",
    async () => {
      const page = await recordHistoryFor(DEMO, "ECO", "ECO-318");
      const e = page.entries;
      const newestFirst = e.every(
        (h, i, a) =>
          i === 0 ||
          new Date(a[i - 1]!.createdAt).getTime() >=
            new Date(h.createdAt).getTime(),
      );
      // paginated shape (nextCursor field present, null for a short trail)
      const paginated = "nextCursor" in page;
      // org-scoped: a 2nd org sees ZERO of this org's history
      const second = await recordHistoryFor(SECOND, "ECO", "ECO-318");
      return (
        e.length >= 2 &&
        newestFirst &&
        paginated &&
        e.every((h) => !!h.action && !!h.summary) &&
        second.entries.length === 0
      );
    },
  );
  await check(
    "getRecordHistory (low-level) filters by (targetType,targetId); wrong id → empty",
    async () => {
      const db = dbForOrg(DEMO);
      const { resolveEntityId } = await import("@axona/db");
      const id = await resolveEntityId(db, "ECO", "ECO-318");
      if (!id) return false;
      const hit = await getRecordHistory(db, {
        targetType: "ECO",
        targetId: id,
      });
      const miss = await getRecordHistory(db, {
        targetType: "ECO",
        targetId: "does-not-exist",
      });
      return hit.entries.length >= 2 && miss.entries.length === 0;
    },
  );

  // ── 3: agent entries carry model+confidence; before→after from inputs/output ──
  await check(
    "AGENT entry shows AUDIT.3 model + CONF.1 confidence; the trail carries inputs + output",
    async () => {
      const { entries } = await recordHistoryFor(DEMO, "ECO", "ECO-318");
      const agent = entries.find((h) => h.actorType === "AGENT");
      const hasInputs = entries.some(
        (h) => h.inputs && typeof h.inputs === "object",
      );
      const hasOutput = entries.some(
        (h) => h.output && typeof h.output === "object",
      );
      return (
        !!agent &&
        !!agent.model &&
        agent.confidence !== null &&
        !!agent.calibrated && // CONF.1 calibrated value present
        hasInputs && // before
        hasOutput // after
      );
    },
  );

  // ── 4 (data): empty state — a record with no audited history ──
  await check(
    "empty state: a record with no audit entries returns an empty history",
    async () => {
      const page = await recordHistoryFor(DEMO, "UNIT", "SN-2208");
      return page.entries.length === 0 && page.nextCursor === null;
    },
  );

  const { prisma } = await import("@axona/db");
  await prisma.$disconnect();
  finish();
}

function finish(): void {
  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
