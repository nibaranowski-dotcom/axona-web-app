import { dbForOrg, writeAudit } from "@axona/db";

// PLM.5 — the field-service hand-off, as a testable unit. The server action does
// the auth (requireRole line 1) and calls this; keeping the effect here means
// verify can exercise the REAL write path (and clean up after itself) instead of
// only asserting that the code looks right.

export interface HandOffActor {
  id: string;
  label: string;
  orgId: string;
}

export interface HandOffResult {
  raised: string[];
  skippedNotDeployed: string[];
  skippedAlreadyOpen: string[];
}

export function handOffIssue(traceRoot: string): string {
  return `Inspect — affected by ${traceRoot}`;
}

/**
 * Raise one field work order per AFFECTED, DEPLOYED unit. Idempotent per trace
 * root: a unit that already has an open work order for the same root is skipped
 * rather than double-dispatched. Writes an AUDIT.1 entry naming the human actor.
 */
export async function handOffToFieldService(
  actor: HandOffActor,
  serials: string[],
  traceRoot: string,
): Promise<HandOffResult> {
  const db = dbForOrg(actor.orgId); // org-scoped

  // Only units that actually exist in THIS org.
  const units = await db.unit.findMany({ where: { serial: { in: serials } } });
  const deployed = units.filter(
    (u) => u.status === "deployed" || u.status === "active",
  );
  const skippedNotDeployed = units
    .filter((u) => !deployed.includes(u))
    .map((u) => u.serial)
    .sort();

  const issue = handOffIssue(traceRoot);
  const existing = await db.workOrderField.findMany({
    where: {
      robotSerial: { in: deployed.map((u) => u.serial) },
      issue,
      status: { not: "CLOSED" },
    },
  });
  const already = new Set(existing.map((w) => w.robotSerial));
  const toRaise = deployed.filter((u) => !already.has(u.serial));

  if (toRaise.length > 0) {
    // Continue the existing WO series rather than restarting the numbering.
    const last = await db.workOrderField.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let n =
      Number.parseInt((last?.code ?? "WO-5500").replace(/\D/g, ""), 10) || 5500;

    for (const u of toRaise) {
      n += 1;
      await db.workOrderField.create({
        data: {
          // dbForOrg injects orgId at runtime; naming it keeps the type honest.
          orgId: actor.orgId,
          code: `WO-${n}`,
          robotSerial: u.serial,
          site: u.siteLabel ?? "unassigned",
          issue,
          status: "OPEN",
          severity: "MAJOR",
        },
      });
    }

    // AUDIT.1 — inputs · output · approver on the immutable log.
    await writeAudit(db, {
      orgId: actor.orgId,
      actor: { type: "HUMAN", id: actor.id, label: actor.label },
      action: "blastradius.handoff",
      target: { type: "WorkOrderField", id: traceRoot },
      summary: `Handed ${toRaise.length} unit${toRaise.length === 1 ? "" : "s"} affected by ${traceRoot} to field service`,
      inputs: { traceRoot, requested: serials.length },
      output: {
        raised: toRaise.map((u) => u.serial),
        skippedAlreadyOpen: [...already],
      },
      approver: { id: actor.id, label: actor.label },
    });
  }

  return {
    raised: toRaise.map((u) => u.serial).sort(),
    skippedNotDeployed,
    skippedAlreadyOpen: [...already].sort(),
  };
}
