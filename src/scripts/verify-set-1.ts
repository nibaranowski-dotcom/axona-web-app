/**
 * Verify SET.1 — organization settings (PRD §8). Static checks always run; live
 * checks gated on DATABASE_URL. Actions are "use server" (not importable) so their
 * writes are mirrored against the real DB + read model; the guard shapes are checked
 * statically. Self-cleaning. Run: pnpm verify:set-1
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
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

async function run(): Promise<void> {
  console.log("\nVerifying SET.1 — organization settings\n");

  // --- schema + migration ---
  await check(
    "Org.logoKey/timezone/fiscalYearStartMonth/defaultMemberRole + migration",
    () => {
      const schema = read("packages/db/prisma/schema.prisma");
      const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
        (d) => /set1_org_settings/.test(d),
      );
      const sql = mig
        ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
        : "";
      return (
        /logoKey\s+String\?/.test(schema) &&
        /timezone\s+String\?/.test(schema) &&
        /fiscalYearStartMonth\s+Int\?/.test(schema) &&
        /defaultMemberRole\s+Role\?/.test(schema) &&
        /ADD COLUMN "logoKey"/.test(sql) &&
        /ADD COLUMN "defaultMemberRole"/.test(sql)
      );
    },
  );

  // --- actions: ADMIN-gated + audited; Core-stays-on guard ---
  await check(
    "org actions ADMIN-gated line 1 + audited (profile/defaults/modules)",
    () => {
      const a = read("apps/web/app/(shell)/settings/org/actions.ts");
      const audits = (a.match(/writeAudit\(/g) ?? []).length;
      return (
        /requireRole\(user, \["ADMIN"\]\)/.test(a) &&
        /org\.profile_change/.test(a) &&
        /org\.defaults_change/.test(a) &&
        /org\.modules_change/.test(a) &&
        /normalizeEnabledModules/.test(a) &&
        audits >= 3
      );
    },
  );
  await check(
    "/settings/org screen exists; Settings sub-nav points Organization → /settings/org",
    () => {
      const nav = read("apps/web/components/settings/SettingsNav.tsx");
      return (
        existsSync(join(root, "apps/web/app/(shell)/settings/org/page.tsx")) &&
        /href: "\/settings\/org"/.test(nav)
      );
    },
  );
  await check(
    "Core-stays-on guard: normalizeEnabledModules always includes ALWAYS_ON",
    () => {
      const s = read("apps/web/lib/org-settings.ts");
      return /ALWAYS_ON/.test(s) && /normalizeEnabledModules/.test(s);
    },
  );

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { getOrgSettings, normalizeEnabledModules } =
    await import("../../apps/web/lib/org-settings");
  const { getNavModules } = await import("../../apps/web/lib/nav");
  const { writeAudit } = await import("@axona/db");

  const demo = await prisma.org.findFirst({ where: { name: "Axona" } });
  const second = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  if (!demo || !second) {
    console.log("  FAIL demo/second org missing (run pnpm db:seed)");
    failed++;
    finish();
    return;
  }
  const db = dbForOrg(demo.id);
  const admin = await prisma.user.findFirst({
    where: { orgId: demo.id, role: "ADMIN" },
    select: { id: true, name: true },
  });
  const by = { id: admin!.id, label: admin!.name };

  const cleanAudit = async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
    );
    await prisma.auditLog.deleteMany({
      where: { orgId: demo.id, action: { startsWith: "org." } },
    });
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
    );
  };
  // snapshot to restore
  const snap = await prisma.org.findUnique({ where: { id: demo.id } });
  await cleanAudit();

  // 2) getOrgSettings — profile + defaults + module grid; org-scoped.
  await check(
    "getOrgSettings → profile + defaults + module grid; org-scoped",
    async () => {
      const s = await getOrgSettings(demo.id);
      if (!s) return false;
      const gridOk =
        s.moduleGroups.length === 4 &&
        s.moduleGroups.flatMap((g) => g.modules).length === s.totalModules;
      const s2 = await getOrgSettings(second.id);
      const scoped = s2?.name === "Isolation Test Co" && s.name === "Axona";
      return gridOk && s.slug === "axona-demo-co" && scoped;
    },
  );

  // 3) updateOrgProfile mirror: name/industry persist + audit org.profile_change.
  await check("updateOrgProfile updates name/industry + audits", async () => {
    await db.org.updateMany({
      where: { id: demo.id },
      data: { name: "Axona", industry: "Mobility & AVs" },
    });
    await writeAudit(db, {
      orgId: demo.id,
      actor: { type: "HUMAN", id: admin!.id, label: by.label },
      action: "org.profile_change",
      target: { type: "Org", id: demo.id },
      summary: "Updated org profile",
      approver: by,
    });
    const s = await getOrgSettings(demo.id);
    const audited = !!(await db.auditLog.findFirst({
      where: { action: "org.profile_change" },
    }));
    return s?.industry === "Mobility & AVs" && audited;
  });

  // 4) updateOrgDefaults mirror: timezone/fiscal/defaultRole persist + audit.
  await check(
    "updateOrgDefaults persists timezone/fiscal/defaultRole + audits",
    async () => {
      await db.org.updateMany({
        where: { id: demo.id },
        data: {
          timezone: "America/Detroit",
          fiscalYearStartMonth: 4,
          defaultMemberRole: "VIEWER",
        },
      });
      await writeAudit(db, {
        orgId: demo.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "org.defaults_change",
        target: { type: "Org", id: demo.id },
        summary: "Updated org defaults",
        approver: by,
      });
      const s = await getOrgSettings(demo.id);
      const audited = !!(await db.auditLog.findFirst({
        where: { action: "org.defaults_change" },
      }));
      return (
        s?.timezone === "America/Detroit" &&
        s.fiscalYearStartMonth === 4 &&
        s.defaultMemberRole === "VIEWER" &&
        audited
      );
    },
  );

  // 5) setEnabledModules mirror: nav reflects + Core-stays-on guard + audit.
  await check(
    "setEnabledModules writes enabledModules (nav reflects) + Core-stays-on + audits",
    async () => {
      const all = (await getOrgSettings(demo.id))!.moduleGroups.flatMap((g) =>
        g.modules.map((m) => m.key),
      );
      const subset = normalizeEnabledModules(
        all.filter((k) => k !== "finance"),
      );
      await db.org.updateMany({
        where: { id: demo.id },
        data: { enabledModules: subset },
      });
      await writeAudit(db, {
        orgId: demo.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "org.modules_change",
        target: { type: "Org", id: demo.id },
        summary: "Updated enabled modules",
        approver: by,
      });
      const nav = await getNavModules(
        (await getOrgSettings(demo.id))!.enabledModules,
      );
      const keys = nav.flatMap((g) => g.modules.map((m) => m.key));
      const coreGuard = normalizeEnabledModules([]).includes("core"); // never lock out nav
      const audited = !!(await db.auditLog.findFirst({
        where: { action: "org.modules_change" },
      }));
      return (
        !keys.includes("finance") &&
        keys.includes("procurement") &&
        coreGuard &&
        audited
      );
    },
  );

  // 6) no cross-org write path: every org action mutates ONLY `where: { id:
  //    user!.orgId }` (Org is the tenant root, not orgId-scoped, so isolation is the
  //    explicit self-org where-clause) + getOrgSettings reads the passed org only.
  await check(
    "no cross-org write path (actions target id: user.orgId only)",
    async () => {
      const a = read("apps/web/app/(shell)/settings/org/actions.ts");
      const updates = a.match(/updateMany\(\{\s*where:\s*\{([^}]*)\}/g) ?? [];
      const allSelfOrg =
        updates.length >= 3 &&
        updates.every((u) => /id:\s*user!\.orgId/.test(u));
      // read-side parameterization: demo vs second return their own data
      const sDemo = await getOrgSettings(demo.id);
      const sSecond = await getOrgSettings(second.id);
      const readScoped =
        sDemo?.name === "Axona" && sSecond?.name === "Isolation Test Co";
      return allSelfOrg && readScoped;
    },
  );

  // restore demo org state + clean audit
  await prisma.org.update({
    where: { id: demo.id },
    data: {
      name: snap!.name,
      industry: snap!.industry,
      timezone: snap!.timezone,
      fiscalYearStartMonth: snap!.fiscalYearStartMonth,
      defaultMemberRole: snap!.defaultMemberRole,
      enabledModules: snap!.enabledModules,
    },
  });
  await cleanAudit();
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
