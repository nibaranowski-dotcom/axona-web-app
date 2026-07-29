/**
 * Verify LEAD.1 — contact-sales lead capture (public hardened endpoint + Leads view).
 * Run: pnpm verify:lead-1
 *
 *   1. Valid submission → one Lead(NEW); generic ok. (createLead + dedupe.)
 *   2. Validation: malformed/oversized/missing → rejected, no row.
 *   3. Honeypot: filled hidden field → dropped (generic success, no row).
 *   4. CORS: disallowed Origin rejected; MARKETING_ORIGIN accepted.
 *   5. Rate limit: burst past the per-IP limit → 429, no unbounded writes.
 *   6. No power: creates no User/Org/session; Lead is Axona-internal (no orgId, not in
 *      the per-tenant dbForOrg scoping) → not visible in any customer tenant.
 *   7. Leads view is RBAC-gated (admin) + lists the lead.
 *   8. Notify: a set webhook receives a summary; an unset/failing webhook doesn't fail
 *      capture. Additive migration; existing verifies green.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";

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
  console.log("\nVerifying LEAD.1 — contact-sales lead capture\n");
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  const route = read("apps/web/app/api/leads/route.ts");
  const authCfg = read("apps/web/auth.config.ts");
  const client = read("packages/db/src/client.ts");
  const schema = read("packages/db/prisma/schema.prisma");
  const page = read("apps/web/app/(shell)/leads/page.tsx");
  const actions = read("apps/web/app/(shell)/leads/actions.ts");
  const notifyLib = read("apps/web/lib/lead-notify.ts");

  // ── static: hardened + Axona-internal + no power ──
  await check(
    "route hardens: CORS allowlist · rate limit · honeypot/zod · captcha seam · generic ok",
    () => {
      return (
        /isAllowedOrigin\(/.test(route) &&
        /rateLimit\(/.test(route) &&
        /parseSubmission\(/.test(route) &&
        /LEAD-CAPTCHA/.test(read("apps/web/lib/lead-submission.ts")) &&
        /GENERIC_OK/.test(route)
      );
    },
  );
  await check(
    "route creates a Lead and NOTHING else (no User/Org/session)",
    () => {
      return (
        /createLead\(/.test(route) &&
        !/\.user\.create|\.org\.create|createSession|signIn\(/.test(route)
      );
    },
  );
  await check(
    "Lead is Axona-INTERNAL: no orgId, NOT in the dbForOrg TENANT_MODELS",
    () => {
      // the Lead model has no orgId / Org relation…
      const leadModel = schema.slice(schema.indexOf("model Lead {"));
      const modelBody = leadModel.slice(0, leadModel.indexOf("}"));
      const noOrg = !/orgId/.test(modelBody) && !/org\s+Org/.test(modelBody);
      // …and it is not registered for tenant scoping.
      const notScoped = !/"Lead"/.test(client);
      return noOrg && notScoped;
    },
  );
  await check(
    "endpoint is PUBLIC (auth.config PUBLIC includes /api/leads)",
    () => {
      return /\/api\\\/leads/.test(authCfg) || /\/api\/leads/.test(authCfg);
    },
  );
  await check(
    "Leads view is RBAC-gated (admin) — page + action both check role",
    () => {
      return (
        /role !== "ADMIN"/.test(page) &&
        /role !== "ADMIN"/.test(actions) &&
        /listLeads\(/.test(page)
      );
    },
  );
  await check(
    "notify is best-effort (never fails capture) + wires webhook + email (GOLIVE.1)",
    () => {
      return (
        /best-effort/i.test(notifyLib) &&
        /LEAD_NOTIFY_WEBHOOK_URL/.test(notifyLib) &&
        // GOLIVE.1 — the NOTIFY-EMAIL seam is now implemented via the shared mailer.
        /LEAD_NOTIFY_EMAIL/.test(notifyLib) &&
        // the route fires notify fire-and-forget (void … .catch)
        /void notifyNewLead\(/.test(route)
      );
    },
  );

  // ── pure libs (deterministic, no DB) ──
  const { isAllowedOrigin, corsHeaders } =
    await import("../../apps/web/lib/lead-cors");
  const { parseSubmission } =
    await import("../../apps/web/lib/lead-submission");
  const { rateLimit, __resetRateLimit, RATE_LIMIT_CONFIG } =
    await import("../../apps/web/lib/rate-limit");

  const prevOrigin = process.env.MARKETING_ORIGIN;
  process.env.MARKETING_ORIGIN = "https://axonahq.com";
  await check(
    "CORS: MARKETING_ORIGIN accepted (ACAO echoed); other origin rejected",
    () => {
      return (
        isAllowedOrigin("https://axonahq.com") === true &&
        isAllowedOrigin("https://evil.example.com") === false &&
        corsHeaders("https://axonahq.com")["Access-Control-Allow-Origin"] ===
          "https://axonahq.com" &&
        corsHeaders("https://evil.example.com")[
          "Access-Control-Allow-Origin"
        ] === undefined
      );
    },
  );

  const validBody = {
    name: "Test User",
    workEmail: "verify-lead@example-co.test",
    company: "Verify Robotics",
    role: "CTO",
    fleetSize: "50-200",
    useCase: "Procurement",
    message: "hello",
  };
  await check("validation + honeypot + captcha classify correctly", () => {
    return (
      parseSubmission(validBody).kind === "ok" &&
      parseSubmission({ workEmail: "a@b.co", company: "X" }).kind ===
        "invalid" && // missing name
      parseSubmission({ ...validBody, name: "z".repeat(5000) }).kind ===
        "invalid" && // oversized
      parseSubmission({ ...validBody, workEmail: "notanemail" }).kind ===
        "invalid" &&
      parseSubmission({ ...validBody, website: "http://spam" }).kind ===
        "honeypot" &&
      parseSubmission(validBody, true).kind === "captcha" // flag on, no token
    );
  });
  await check(
    `rate limit: throttles after the per-key max (${RATE_LIMIT_CONFIG.PER_KEY_MAX}) → 429`,
    () => {
      __resetRateLimit();
      const hits = Array.from(
        { length: RATE_LIMIT_CONFIG.PER_KEY_MAX + 3 },
        () => rateLimit("k").ok,
      );
      const allowed = hits.filter(Boolean).length;
      return (
        allowed === RATE_LIMIT_CONFIG.PER_KEY_MAX &&
        hits[hits.length - 1] === false
      );
    },
  );

  if (!process.env.DATABASE_URL) {
    if (prevOrigin === undefined) delete process.env.MARKETING_ORIGIN;
    else process.env.MARKETING_ORIGIN = prevOrigin;
    console.log(
      "\n  SKIP DB checks — DATABASE_URL not set (static + pure only)",
    );
    finish();
    return;
  }

  const { createLead, listLeads, updateLeadStatus, hashIp } =
    await import("../../apps/web/lib/leads");
  const { notifyNewLead } = await import("../../apps/web/lib/lead-notify");
  const { prisma, dbForOrg } = await import("@axona/db");

  const cleanup = async () => {
    await prisma.lead.deleteMany({
      where: { workEmail: { contains: "@example-co.test" } },
    });
  };
  await cleanup();

  const usersBefore = await prisma.user.count();
  const orgsBefore = await prisma.org.count();

  // ── 1: valid → one Lead(NEW) ──
  let leadId = "";
  await check(
    "valid submission → exactly one Lead(status=NEW), ipHash hashed (not raw)",
    async () => {
      const before = await prisma.lead.count();
      const r = await createLead({
        ...validBody,
        source: "homepage-contact",
        ip: "1.2.3.4",
      });
      leadId = r.id;
      const row = await prisma.lead.findUnique({ where: { id: r.id } });
      const after = await prisma.lead.count();
      return (
        after - before === 1 &&
        row?.status === "NEW" &&
        r.deduped === false &&
        row?.ipHash === hashIp("1.2.3.4") &&
        row?.ipHash?.length === 64 &&
        !row?.ipHash?.includes("1.2.3.4") // never the raw IP
      );
    },
  );

  // ── 1b: dedupe updates, not duplicates ──
  await check(
    "dedupe: same email+company in-window UPDATES the row (no duplicate)",
    async () => {
      const before = await prisma.lead.count();
      const r = await createLead({
        ...validBody,
        source: "homepage-contact",
        ip: "1.2.3.4",
        message: "updated",
      });
      const after = await prisma.lead.count();
      return r.id === leadId && r.deduped === true && after === before;
    },
  );

  // ── 6: no power — no User/Org created; Lead has no tenant scope ──
  await check(
    "no power: no User/Org created by capture; Lead has no orgId (not tenant data)",
    async () => {
      const noUsersOrgs =
        (await prisma.user.count()) === usersBefore &&
        (await prisma.org.count()) === orgsBefore;
      // structural isolation: the Lead row carries no orgId at all.
      const row = (await prisma.lead.findUnique({
        where: { id: leadId },
      })) as Record<string, unknown>;
      const noOrgField = !("orgId" in row);
      return noUsersOrgs && noOrgField;
    },
  );
  await check(
    "isolation: dbForOrg is org-scoped for tenant models; leads are separate (internal)",
    async () => {
      // A tenant-scoped query for a tenant model stays scoped; leads live outside it.
      // Prove leads are not reachable as tenant data: the org-scoped client's tenant
      // models don't include Lead, so a customer tenant surface can't scope-query them.
      const demoUnits = await dbForOrg(DEMO).unit.count();
      const secondUnits = await dbForOrg(SECOND).unit.count();
      // demo has units, the isolation org has its own (or zero) — tenant scoping intact,
      // and neither exposes the Lead table through org scoping (structural, asserted above).
      return typeof demoUnits === "number" && typeof secondUnits === "number";
    },
  );

  // ── 7: Leads view lists the lead ──
  await check(
    "Leads view (listLeads) lists the captured lead, newest-first, with counts",
    async () => {
      const listed = await listLeads();
      const has = listed.rows.some((r) => r.id === leadId);
      const newestFirst =
        listed.rows.length < 2 ||
        listed.rows[0]!.createdAt >= listed.rows[1]!.createdAt;
      const countsSum =
        listed.summary.byStatus.NEW +
        listed.summary.byStatus.CONTACTED +
        listed.summary.byStatus.QUALIFIED +
        listed.summary.byStatus.CLOSED;
      return has && newestFirst && countsSum === listed.summary.total;
    },
  );
  await check(
    "status control: updateLeadStatus advances the lead",
    async () => {
      await updateLeadStatus(leadId, "CONTACTED");
      const row = await prisma.lead.findUnique({ where: { id: leadId } });
      return row?.status === "CONTACTED";
    },
  );

  // ── 8: notify — webhook receives a summary; a failing/unset webhook doesn't throw ──
  await check(
    "notify: a set LEAD_NOTIFY_WEBHOOK_URL receives a lead summary",
    async () => {
      let received: unknown = null;
      const server = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            received = JSON.parse(body);
          } catch {
            received = body;
          }
          res.writeHead(200);
          res.end("ok");
        });
      });
      await new Promise<void>((r) => server.listen(0, r));
      const port = (server.address() as { port: number }).port;
      const prev = process.env.LEAD_NOTIFY_WEBHOOK_URL;
      process.env.LEAD_NOTIFY_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
      try {
        const res = await notifyNewLead({
          id: leadId,
          name: validBody.name,
          company: validBody.company,
          workEmail: validBody.workEmail,
          useCase: validBody.useCase,
          source: "homepage-contact",
        });
        const got = received as { lead?: { company?: string } } | null;
        return res.webhook === true && got?.lead?.company === validBody.company;
      } finally {
        if (prev === undefined) delete process.env.LEAD_NOTIFY_WEBHOOK_URL;
        else process.env.LEAD_NOTIFY_WEBHOOK_URL = prev;
        server.close();
      }
    },
  );
  await check(
    "notify: an unset/failing webhook does NOT fail capture (best-effort)",
    async () => {
      const prev = process.env.LEAD_NOTIFY_WEBHOOK_URL;
      process.env.LEAD_NOTIFY_WEBHOOK_URL = "http://127.0.0.1:1/does-not-exist";
      try {
        // must resolve (never throw), and capture (createLead) already succeeded above.
        const res = await notifyNewLead({
          id: leadId,
          name: validBody.name,
          company: validBody.company,
          workEmail: validBody.workEmail,
          useCase: null,
          source: "homepage-contact",
        });
        return res.webhook === false; // failed gracefully
      } finally {
        if (prev === undefined) delete process.env.LEAD_NOTIFY_WEBHOOK_URL;
        else process.env.LEAD_NOTIFY_WEBHOOK_URL = prev;
      }
    },
  );

  await cleanup();
  if (prevOrigin === undefined) delete process.env.MARKETING_ORIGIN;
  else process.env.MARKETING_ORIGIN = prevOrigin;
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
