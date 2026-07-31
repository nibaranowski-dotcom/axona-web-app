/**
 * Verify VERIFY.4 — no self-clean deletes audit rows by a pattern.
 * Run: pnpm verify:verify-4
 *
 * The defect: verify scripts restored the seed with wildcard predicates —
 * `DELETE FROM "AuditLog" WHERE action LIKE 'po.approve.%'`, or the Prisma form
 * `auditLog.deleteMany({ where: { action: { startsWith: "billing." } } })`. A
 * pattern cannot distinguish the rows THIS run wrote from seeded or foreign rows
 * that share the prefix, and `self-clean.ts`'s own comment records that this shape
 * once destroyed CONF.1's calibration history.
 *
 * It was live in nine scripts (rbac-4 · rbac-5 · trust-1 · br-1 · audit-1 · audit-3
 * · set-1 · set-2 · set-5 · bill-3) and only missed the seeded rows by luck: the
 * seed writes `eco.release` and `po.approve`, while the patterns required a
 * trailing dot (`eco.release.%`). One seeded action named `po.approve.x` would have
 * silently deleted real history.
 *
 * The fix is one rule: **restore audit rows by EXACT id.** `captureSeededState`
 * snapshots ids before the run and deletes only what appeared. Where a raw
 * statement is genuinely needed, `execScopedAuditDelete` is the only sanctioned
 * path and it throws on a pattern.
 *
 * These are static checks. AUDIT.1 immutability is unaffected — the append-only
 * rule is still asserted by verify:audit-1 / verify:audit-3, whose deliberate
 * `DELETE ... WHERE id=$1` ASSERTIONS (the row must survive) are exempt below.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const ROOT = process.cwd();
const SCRIPTS = join(ROOT, "src/scripts");
const read = (p: string): string =>
  existsSync(p) ? readFileSync(p, "utf8") : "";

/** Assert what the code DOES, not what its comments explain. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

function scriptFiles(): string[] {
  const out: string[] = [];
  for (const f of readdirSync(SCRIPTS)) {
    if (f.endsWith(".ts")) out.push(join(SCRIPTS, f));
  }
  const lib = join(SCRIPTS, "lib");
  if (existsSync(lib)) {
    for (const f of readdirSync(lib)) {
      if (f.endsWith(".ts")) out.push(join(lib, f));
    }
  }
  return out;
}

/** `auditLog.deleteMany({...})` argument objects, in code (comments stripped). */
function prismaAuditDeletes(code: string): string[] {
  const out: string[] = [];
  const re = /auditLog\s*\.\s*deleteMany\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(code.slice(m.index, i + 1));
  }
  return out;
}

function run(): void {
  console.log("\nVerifying VERIFY.4 — audit self-clean restores by exact id\n");

  const selfClean = read(join(SCRIPTS, "lib/self-clean.ts"));
  const files = scriptFiles();

  check("self-clean.ts exists", () => selfClean.length > 0);

  // ── the guard itself ────────────────────────────────────────────────────
  check(
    "1. self-clean exports the pattern guard + the sanctioned raw path",
    () => {
      return (
        /export function assertScopedAuditDelete/.test(selfClean) &&
        /export async function execScopedAuditDelete/.test(selfClean)
      );
    },
  );

  check("1b. the guard catches LIKE · ILIKE · SIMILAR TO · ~~ · %", () => {
    const re = /const AUDIT_PATTERN_DELETE\s*=\s*([\s\S]*?);/.exec(
      selfClean,
    )?.[1];
    if (!re) return false;
    return ["LIKE", "ILIKE", "SIMILAR", "~~", "%"].every((t) => re.includes(t));
  });

  check(
    "1c. execScopedAuditDelete asserts FIRST and re-enables the rule",
    () => {
      const body = /export async function execScopedAuditDelete[\s\S]*$/.exec(
        selfClean,
      )?.[0];
      if (!body) return false;
      const assertAt = body.indexOf("assertScopedAuditDelete(sql)");
      const runAt = body.indexOf("$executeRawUnsafe(sql");
      return (
        assertAt > 0 &&
        runAt > assertAt &&
        /finally \{[\s\S]*?ENABLE RULE audit_no_delete/.test(body)
      );
    },
  );

  check("1d. captureSeededState restores AuditLog BY ID only", () => {
    const branch = /if \(m === "AuditLog"\)[\s\S]*?\n {8}\} else/.exec(
      selfClean,
    )?.[0];
    return (
      !!branch &&
      /where: \{ id: \{ in: created \} \}/.test(branch) &&
      !/LIKE|startsWith/.test(branch)
    );
  });

  // ── the sweep: no pattern deletes anywhere ──────────────────────────────
  check("2. no raw SQL pattern DELETE against AuditLog in any script", () => {
    const bad: string[] = [];
    for (const f of files) {
      const code = codeOnly(read(f));
      // NB: the char class must allow quotes — the statement lives in a template
      // literal and contains `"AuditLog"`, so stopping at `"` matched nothing useful.
      const re = /DELETE\s+FROM\s+"?AuditLog"?[^`]*/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        if (/\bLIKE\b|\bILIKE\b|\bSIMILAR\s+TO\b|~~|%/i.test(m[0])) {
          bad.push(`${f.split("/").pop()}: ${m[0].trim().slice(0, 80)}`);
        }
      }
    }
    for (const b of bad) console.log(`       ${b}`);
    return bad.length === 0;
  });

  check("3. no Prisma pattern DELETE against AuditLog in any script", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const call of prismaAuditDeletes(codeOnly(read(f)))) {
        const args = call.replace(/\s+/g, " ");
        // Safe: id-scoped restore (the rows this run created).
        const byId = /where: \{ id: \{ in: /.test(args);
        // Safe: a WHOLE-TENANT reset — `where: { orgId }` and nothing else. That
        // is `clearOrgData()` wiping one throwaway prospect org before reseeding
        // it; it is bounded to that tenant and deliberately complete, the opposite
        // of guessing at a prefix. A tenant filter COMBINED with an action filter
        // is the dangerous hybrid the old code used, and is NOT exempt.
        const wholeTenant =
          /^auditLog\.deleteMany\(\{ where: \{ orgId \} \}\)$/.test(args);
        if (!byId && !wholeTenant) {
          bad.push(`${f.split("/").pop()}: ${args.slice(0, 90)}`);
        }
      }
    }
    for (const b of bad) console.log(`       ${b}`);
    return bad.length === 0;
  });

  check(
    "4. every raw AuditLog DELETE is an immutability ASSERTION or scoped",
    () => {
      // Allowed: `WHERE id=$1` inside verify-audit-1/3 (they PROVE the append-only
      // rule blocks the delete — the row must still be there afterwards), the
      // sanctioned helper, and self-clean.ts's own machinery.
      const bad: string[] = [];
      for (const f of files) {
        const name = f.split("/").pop() ?? "";
        if (name === "self-clean.ts") continue;
        const code = codeOnly(read(f));
        const re = /DELETE\s+FROM\s+"?AuditLog"?[^`]*/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) {
          const stmt = m[0].trim();
          const isImmutabilityAssertion =
            /WHERE\s+id=\$1/i.test(stmt) &&
            (name === "verify-audit-1.ts" || name === "verify-audit-3.ts");
          const before = code.slice(Math.max(0, m.index - 200), m.index);
          const viaHelper = /execScopedAuditDelete\(/.test(before);
          if (!isImmutabilityAssertion && !viaHelper) {
            bad.push(`${name}: ${stmt.slice(0, 80)}`);
          }
        }
      }
      for (const b of bad) console.log(`       ${b}`);
      return bad.length === 0;
    },
  );

  check(
    "5. the scripts that write audit rows restore them via the guard",
    () => {
      // Each of these calls decide()/writeAudit and previously pattern-deleted.
      const owners = [
        "verify-rbac-4.ts",
        "verify-rbac-5.ts",
        "verify-trust-1.ts",
        "verify-br-1.ts",
        "verify-audit-1.ts",
        "verify-audit-3.ts",
        "verify-set-1.ts",
        "verify-set-2.ts",
        "verify-set-5.ts",
        "verify-bill-3.ts",
      ];
      const missing = owners.filter((n) => {
        const code = codeOnly(read(join(SCRIPTS, n)));
        const capture =
          /captureSeededState\([\s\S]{0,200}?\)/.exec(code)?.[0] ?? "";
        return !/captureSeededState/.test(code) || !/"AuditLog"/.test(capture);
      });
      for (const n of missing)
        console.log(`       ${n} does not capture AuditLog`);
      return missing.length === 0;
    },
  );

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
