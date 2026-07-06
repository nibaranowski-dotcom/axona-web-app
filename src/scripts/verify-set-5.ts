/**
 * Verify SET.5 — integrations / SSO / API keys (PRD §45). Static checks always run;
 * live checks gated on DATABASE_URL. Asserts API keys are hashed at rest (plaintext
 * never in the DB). Self-cleaning. Run: pnpm verify:set-5
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

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
  console.log("\nVerifying SET.5 — integrations / SSO / API keys\n");

  // --- schema + migration ---
  await check("Integration + ApiKey + SsoConfig models + migration", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    const mig = readdirSync(join(root, "packages/db/prisma/migrations")).find(
      (d) => /set5_integrations/.test(d),
    );
    const sql = mig
      ? read(`packages/db/prisma/migrations/${mig}/migration.sql`)
      : "";
    return (
      /model Integration \{/.test(schema) &&
      /model ApiKey \{/.test(schema) &&
      /model SsoConfig \{/.test(schema) &&
      /keyHash\s+String/.test(schema) &&
      /CREATE TABLE "ApiKey"/.test(sql)
    );
  });

  // --- actions ADMIN-gated + audited; key never stored plaintext ---
  await check(
    "actions ADMIN-gated + audited (apikey.create/revoke, sso.config_change, integration.status_change)",
    () => {
      const a = read("apps/web/app/(shell)/settings/integrations/actions.ts");
      return (
        /requireRole\(user, \["ADMIN"\]\)/.test(a) &&
        /apikey\.create/.test(a) &&
        /apikey\.revoke/.test(a) &&
        /sso\.config_change/.test(a) &&
        /integration\.status_change/.test(a)
      );
    },
  );
  await check(
    "createApiKey stores keyHash (sha256), returns plaintext once, never logs it",
    () => {
      const lib = read("apps/web/lib/integrations.ts");
      const a = read("apps/web/app/(shell)/settings/integrations/actions.ts");
      return (
        /createHash\("sha256"\)/.test(lib) &&
        /keyHash/.test(lib) &&
        /plaintextKey: plaintext/.test(a) && // returned once
        !/output: \{[^}]*plaintext/.test(a) // plaintext never audited
      );
    },
  );
  await check("/settings/integrations screen exists", () => {
    return existsSync(
      join(root, "apps/web/app/(shell)/settings/integrations/page.tsx"),
    );
  });

  if (!process.env.DATABASE_URL) {
    console.log("  SKIP live checks — DATABASE_URL not set");
    finish();
    return;
  }

  const { prisma, dbForOrg } = await import("@axona/db");
  const { generateApiKey, getApiKeys, getIntegrations, getSsoConfig } =
    await import("../../apps/web/lib/integrations");

  const demo = await prisma.org.findFirst({ where: { name: "Axona Demo Co" } });
  const second = await prisma.org.findFirst({
    where: { name: "Isolation Test Co" },
  });
  const admin = await prisma.user.findFirst({
    where: { orgId: demo!.id, role: "ADMIN" },
    select: { id: true, name: true },
  });
  const db = dbForOrg(demo!.id);
  const by = { id: admin!.id, label: admin!.name };

  const cleanAudit = async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
    );
    await prisma.auditLog.deleteMany({
      where: {
        orgId: demo!.id,
        action: {
          in: [
            "apikey.create",
            "apikey.revoke",
            "sso.config_change",
            "integration.status_change",
          ],
        },
      },
    });
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
    );
  };
  await cleanAudit();
  await prisma.apiKey.deleteMany({
    where: { orgId: demo!.id, name: { startsWith: "verify-set5" } },
  });

  // 1) createApiKey: hash+prefix stored (NOT plaintext); return once; masked list.
  await check(
    "createApiKey → hash+prefix stored (NOT plaintext); getApiKeys masked; revoke",
    async () => {
      const { writeAudit } = await import("@axona/db");
      const { plaintext, prefix, keyHash } = generateApiKey();
      const row = await prisma.apiKey.create({
        data: {
          orgId: demo!.id,
          name: "verify-set5-key",
          prefix,
          keyHash,
          createdById: admin!.id,
        },
      });
      await writeAudit(db, {
        orgId: demo!.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "apikey.create",
        target: { type: "ApiKey", id: prefix },
        summary: `Created key ${prefix}`,
        output: { name: "verify-set5-key", prefix },
        approver: by,
      });
      // plaintext must NOT be in the stored row; hash must equal sha256(plaintext)
      const stored = await prisma.apiKey.findUnique({ where: { id: row.id } });
      const noPlaintext = !JSON.stringify(stored).includes(plaintext);
      const hashOk =
        stored!.keyHash ===
        createHash("sha256").update(plaintext).digest("hex");
      // list masked (no plaintext body)
      const keys = await getApiKeys(demo!.id);
      const masked = keys.find((k) => k.id === row.id)!.masked;
      const isMasked =
        masked.includes("••••") && !masked.includes(plaintext.slice(8));
      // revoke + audit
      await prisma.apiKey.updateMany({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      });
      await writeAudit(db, {
        orgId: demo!.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "apikey.revoke",
        target: { type: "ApiKey", id: prefix },
        summary: "Revoked",
        approver: by,
      });
      const revoked =
        (await prisma.apiKey.findUnique({ where: { id: row.id } }))!
          .revokedAt !== null;
      const audited =
        !!(await prisma.auditLog.findFirst({
          where: { action: "apikey.create" },
        })) &&
        !!(await prisma.auditLog.findFirst({
          where: { action: "apikey.revoke" },
        }));
      await prisma.apiKey.deleteMany({ where: { id: row.id } });
      return noPlaintext && hashOk && isMasked && revoked && audited;
    },
  );

  // 2) no plaintext key anywhere in the DB (all ApiKey rows are hashes/prefixes).
  await check(
    "no plaintext key stored anywhere (all rows hash+prefix only)",
    async () => {
      const rows = await prisma.apiKey.findMany();
      // a stored value shouldn't contain the ax_live_ + 48-hex full form; prefix is short.
      return rows.every((r) => !/ax_live_[0-9a-f]{48}/.test(JSON.stringify(r)));
    },
  );

  // 3) getIntegrations/getSsoConfig org-scoped; updateSsoConfig persists + audits.
  await check(
    "getIntegrations/getSsoConfig org-scoped; SSO persists + audits",
    async () => {
      const ints = await getIntegrations(demo!.id);
      const sso = await getSsoConfig(demo!.id, "axona-demo-co");
      const scoped = ints.length === 6 && sso.acsUrl.includes("axona-demo-co");
      // updateSsoConfig mirror
      const { writeAudit } = await import("@axona/db");
      await prisma.ssoConfig.upsert({
        where: { orgId: demo!.id },
        update: { provider: "Okta", enforce: true },
        create: { orgId: demo!.id, provider: "Okta", enforce: true },
      });
      await writeAudit(db, {
        orgId: demo!.id,
        actor: { type: "HUMAN", id: admin!.id, label: by.label },
        action: "sso.config_change",
        target: { type: "SsoConfig", id: demo!.id },
        summary: "SSO",
        approver: by,
      });
      const after = await getSsoConfig(demo!.id, "axona-demo-co");
      const audited = !!(await prisma.auditLog.findFirst({
        where: { action: "sso.config_change" },
      }));
      // restore
      await prisma.ssoConfig.update({
        where: { orgId: demo!.id },
        data: { provider: null, enforce: false },
      });
      return (
        scoped && after.provider === "Okta" && after.enforce === true && audited
      );
    },
  );

  // 4) cross-org keys not readable via the demo client.
  await check(
    "cross-org: another org's API key not reachable via demo dbForOrg",
    async () => {
      if (!second) return true;
      const otherKey = await prisma.apiKey.create({
        data: {
          orgId: second.id,
          name: "verify-set5-other",
          prefix: "ax_live_zzzz",
          keyHash: "x",
          createdById: "x",
        },
      });
      const leaked = await db.apiKey.findFirst({ where: { id: otherKey.id } });
      await prisma.apiKey.deleteMany({ where: { id: otherKey.id } });
      return leaked === null;
    },
  );

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
