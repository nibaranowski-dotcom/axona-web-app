import type { PrismaClient } from "@axona/db";

// HOUSE.1 / MIGRATE.1 — narrow, self-cleaning residue guard for verify scripts.
//
// A verify run must restore the seeded state (MIGRATE.1). Scripts that exercise
// real flows (runAgent → AgentRun, draftPurchaseOrder → PurchaseOrder, decide()/
// writeAudit → AuditLog, sign-in → LoginSession) were leaving rows behind, so
// Procurement drifted to 14 POs instead of the seeded 11 and verify:all was not
// idempotent.
//
// This captures the id-set of each named model BEFORE the body runs, then after
// deletes EXACTLY the rows that appeared during the run — id-scoped, never a
// pattern delete (a broad `action LIKE 'po.approve.%'` once nuked CONF.1's
// calibration history; that must never recur). AuditLog is append-only (a DB rule
// makes DELETE a no-op); for our own rows we briefly disable that rule for the
// id-scoped delete and re-enable it — verify/dev cleanup only, so the app's
// immutability guarantee is untouched.
//
// Usage:
//   const guard = await captureSeededState(prisma, ["PurchaseOrder", "AgentRun"]);
//   try { ...checks that create rows... } finally { await guard.restore(); }

interface RowDelegate {
  findMany: (args: { select: { id: true } }) => Promise<{ id: string }[]>;
  deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
}
type AnyPrisma = PrismaClient & Record<string, RowDelegate>;

const delegate = (prisma: PrismaClient, model: string): RowDelegate =>
  (prisma as AnyPrisma)[model.charAt(0).toLowerCase() + model.slice(1)]!;

export interface SeededGuard {
  restore(): Promise<void>;
}

// VERIFY.4 — the pattern-delete guard.
//
// Cleanup used to say `DELETE FROM "AuditLog" WHERE orgId=$1 AND action LIKE
// 'po.approve.%'`. A wildcard predicate does not distinguish the rows THIS run
// wrote from seeded or foreign rows that happen to share the prefix — that shape
// once nuked CONF.1's calibration history. Restores are id-scoped; the only
// sanctioned raw path is `execScopedAuditDelete`, and it refuses a pattern.
const AUDIT_PATTERN_DELETE =
  /\bDELETE\b[\s\S]*?\bFROM\b\s*"?AuditLog"?[\s\S]*?(\bLIKE\b|\bILIKE\b|\bSIMILAR\s+TO\b|~~|%)/i;

/**
 * Throws if `sql` deletes audit rows by a wildcard/pattern predicate. Exported so
 * any future raw cleanup can assert itself; `execScopedAuditDelete` applies it.
 */
export function assertScopedAuditDelete(sql: string): void {
  if (AUDIT_PATTERN_DELETE.test(sql)) {
    throw new Error(
      "VERIFY.4: refusing a pattern DELETE against AuditLog.\n" +
        "  A LIKE/% predicate cannot tell this run's rows from seeded or foreign ones\n" +
        "  (this shape once destroyed CONF.1's calibration history).\n" +
        '  Restore by EXACT id instead — captureSeededState(prisma, ["AuditLog", …])\n' +
        "  snapshots ids before the run and deletes only what appeared.\n" +
        `  offending sql: ${sql.trim().slice(0, 160)}`,
    );
  }
}

/**
 * The ONLY sanctioned raw audit-row cleanup. Asserts the predicate is not a
 * pattern, then runs it with the append-only rule disabled for exactly that
 * statement. AUDIT.1 immutability is untouched — the rule is re-enabled in a
 * `finally`, and the app never takes this path (verify/dev cleanup only).
 */
export async function execScopedAuditDelete(
  prisma: PrismaClient,
  sql: string,
  ...params: unknown[]
): Promise<void> {
  assertScopedAuditDelete(sql);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DISABLE RULE audit_no_delete`,
  );
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } finally {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "AuditLog" ENABLE RULE audit_no_delete`,
    );
  }
}

export async function captureSeededState(
  prisma: PrismaClient,
  models: string[],
): Promise<SeededGuard> {
  const snapshots: { model: string; ids: Set<string> }[] = [];
  for (const m of models) {
    const rows = await delegate(prisma, m).findMany({ select: { id: true } });
    snapshots.push({
      model: m,
      ids: new Set(rows.map((r: { id: string }) => r.id)),
    });
  }

  return {
    async restore() {
      // Children before parents isn't a concern for our set (AgentRun/PO/AuditLog/
      // LoginSession have no dependent rows), but reverse the order for safety.
      for (const { model: m, ids } of [...snapshots].reverse()) {
        const rows = await delegate(prisma, m).findMany({
          select: { id: true },
        });
        const created = rows
          .map((r: { id: string }) => r.id)
          .filter((id: string) => !ids.has(id));
        if (created.length === 0) continue;
        if (m === "AuditLog") {
          // append-only: disable the delete rule ONLY for this narrow id-scoped
          // cleanup, then re-enable it immediately.
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "AuditLog" DISABLE RULE "audit_no_delete"`,
          );
          try {
            await delegate(prisma, m).deleteMany({
              where: { id: { in: created } },
            });
          } finally {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "AuditLog" ENABLE RULE "audit_no_delete"`,
            );
          }
        } else {
          await delegate(prisma, m).deleteMany({
            where: { id: { in: created } },
          });
        }
      }
    },
  };
}
