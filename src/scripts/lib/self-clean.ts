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
