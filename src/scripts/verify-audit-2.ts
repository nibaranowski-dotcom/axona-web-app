/**
 * Verify AUDIT.2 — audit-trail viewer (read model + screen). Static checks always
 * run; live checks gated on DATABASE_URL. Read-only — asserts no write path exists.
 * Run: pnpm verify:audit-2
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
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying AUDIT.2 — audit-trail viewer\n");

  // --- static: route/screen exist; read-only (no write path); no edit/delete UI ---
  await check("route + screen + read model exist", () => {
    return (
      existsSync(join(root, "apps/web/app/(shell)/audit/page.tsx")) &&
      existsSync(join(root, "apps/web/components/audit/AuditView.tsx")) &&
      existsSync(join(root, "apps/web/lib/audit-trail.ts")) &&
      existsSync(join(root, "apps/web/app/api/audit/route.ts"))
    );
  });
  await check(
    "read-only — no write path (GET-only route; no auditLog mutation)",
    () => {
      const route = read("apps/web/app/api/audit/route.ts");
      const lib = read("apps/web/lib/audit-trail.ts");
      const view = read("apps/web/components/audit/AuditView.tsx");
      const routeGetOnly =
        /export async function GET/.test(route) &&
        !/export async function (POST|PUT|PATCH|DELETE)/.test(route);
      const libNoMutation =
        !/auditLog\.(create|update|updateMany|delete|deleteMany|upsert)/.test(
          lib,
        );
      const noEditUi = !/onDelete|onEdit|Delete entry|Edit entry/.test(view);
      return routeGetOnly && libNoMutation && noEditUi;
    },
  );
  await check("reachable — sidebar links /audit", () => {
    return /href="\/audit"/.test(read("apps/web/components/shell/Sidebar.tsx"));
  });
  await check("low-confidence flagged in INK (no invented reds)", () => {
    const view = read("apps/web/components/audit/AuditView.tsx");
    return (
      /LOW_CONFIDENCE/.test(view) &&
      /Review/.test(view) &&
      /bg-ink-strong/.test(view) &&
      !/\bbg-red|text-red|border-red\b/.test(view)
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma } = await import("@axona/db");
  const {
    getAuditTrail,
    getAuditRollup,
    getAuditFilterOptions,
    LOW_CONFIDENCE,
  } = await import("../../apps/web/lib/audit-trail");

  const org = await prisma.org.findFirst({ where: { name: "Axona" } });
  if (!org) {
    console.log("  FAIL demo org missing (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }

  await check(
    "paginates (nextCursor when more; next page is disjoint)",
    async () => {
      const p1 = await getAuditTrail(org.id, { take: 5 });
      if (!p1.nextCursor || p1.entries.length !== 5) return false;
      const p2 = await getAuditTrail(org.id, {
        take: 5,
        cursor: p1.nextCursor,
      });
      const ids1 = new Set(p1.entries.map((e) => e.id));
      return p2.entries.length > 0 && p2.entries.every((e) => !ids1.has(e.id));
    },
  );

  await check("filters by actor / action / targetType", async () => {
    const opts = await getAuditFilterOptions(org.id);
    const agent = await getAuditTrail(org.id, { actor: "AGENT", take: 50 });
    const someAction =
      opts.actions.find((a) => a === "po.advance") ?? opts.actions[0];
    const byAction = await getAuditTrail(org.id, {
      action: someAction,
      take: 50,
    });
    const byTarget = await getAuditTrail(org.id, {
      targetType: "PurchaseOrder",
      take: 50,
    });
    return (
      agent.entries.length > 0 &&
      agent.entries.every((e) => e.actorType === "AGENT") &&
      byAction.entries.every((e) => e.action === someAction) &&
      byTarget.entries.every((e) => e.targetType === "PurchaseOrder")
    );
  });

  await check(
    "agent entries expose model+confidence; approvals expose approver",
    async () => {
      const { entries } = await getAuditTrail(org.id, { take: 100 });
      const agent = entries.find(
        (e) => e.actorType === "AGENT" && e.model && e.confidence !== null,
      );
      const approval = entries.find((e) => e.approverLabel);
      return !!agent && !!approval;
    },
  );

  await check("a low-confidence entry is flagged (< threshold)", async () => {
    const { entries } = await getAuditTrail(org.id, { take: 100 });
    return entries.some(
      (e) => e.confidence !== null && e.confidence < LOW_CONFIDENCE,
    );
  });

  await check(
    "targets deep-link where derivable; unlinked types are plain",
    async () => {
      const { entries } = await getAuditTrail(org.id, { take: 100 });
      // Orphan-tolerant: a target whose row was deleted (e.g. by a sibling verify)
      // resolves to null — allowed. Assert the PREFIXES are correct wherever a link
      // resolves, the deterministic PurchaseOrder→/procurement holds, and at least
      // one derivable target actually resolved (proving resolution works).
      const po = entries.find((e) => e.targetType === "PurchaseOrder");
      const prefixesOk = entries.every((e) => {
        switch (e.targetType) {
          case "PurchaseOrder":
            return e.href === "/procurement";
          case "WorkflowRun":
            return e.href === null || e.href.startsWith("/workflows/");
          case "MatrixColumn":
          case "File":
            return e.href === null || e.href.startsWith("/projects/");
          case "ECO":
          case "NCR":
          case "Org":
            return e.href === null; // no dedicated screen → plain text
          default:
            return true;
        }
      });
      const someResolved = entries.some(
        (e) =>
          e.href?.startsWith("/projects/") || e.href?.startsWith("/workflows/"),
      );
      return po?.href === "/procurement" && prefixesOk && someResolved;
    },
  );

  await check(
    "rollup counts (agent/human/approvals/low-conf); cross-org empty",
    async () => {
      const roll = await getAuditRollup(org.id);
      const cross = await getAuditTrail("org_does_not_exist");
      return (
        roll.total >= 15 &&
        roll.agentActions > 0 &&
        roll.humanDecisions > 0 &&
        roll.approvals > 0 &&
        roll.lowConfidence > 0 &&
        cross.entries.length === 0
      );
    },
  );

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

run();
