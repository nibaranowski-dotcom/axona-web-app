"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg, importUnits, type ImportResult } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

// PLM.2 — the registry's one mutation. Bringing units into the registry is a
// write to the genealogy spine (Unit is the billing meter), so it is role-gated
// on line 1 and audited with what actually changed. The dry run is the same code
// path with `dryRun` set — you can never be shown a preview that differs from
// what applying would do.

const MAX_CSV_BYTES = 2_000_000;

export async function importUnitsAction(
  csv: string,
  dryRun: boolean,
): Promise<ImportResult> {
  const user = await getCurrentUser();
  requireRole(user, ["ENGINEER", "ADMIN"]); // line 1 — before any DB call

  if (typeof csv !== "string" || csv.trim().length === 0) {
    throw new Error("Nothing to import — the CSV is empty.");
  }
  if (csv.length > MAX_CSV_BYTES) {
    throw new Error("That file is too large to import in one go.");
  }

  const db = dbForOrg(user.orgId); // org-scoped — a tenant only ever writes its own
  const result = await importUnits(db, csv, { dryRun });

  if (!dryRun) {
    // AUDIT.1 — a real write to the unit spine is an audited event. A dry run is
    // not: nothing changed, so there is nothing to record.
    await writeAudit(db, {
      orgId: user.orgId,
      actor: { type: "HUMAN", id: user.id, label: user.name || user.email },
      action: "unit.import",
      target: { type: "Unit", id: `csv:${result.totalRows}-rows` },
      summary: `Imported units from CSV — ${result.created} created · ${result.updated} updated · ${result.errors.length} rejected`,
      output: {
        created: result.created,
        updated: result.updated,
        rejected: result.errors.length,
      },
      approver: { id: user.id, label: user.name || user.email },
    });
    revalidatePath("/units");
  }

  return result;
}
