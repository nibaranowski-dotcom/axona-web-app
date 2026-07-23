"use server";

import { getCurrentUser } from "@/lib/session";
import { compareTestRuns, type CompareData } from "@/lib/tests";

// PLM.6 — compare mode. Read-only (no mutation, no RBAC gate) but org-scoped: the
// compare is computed from each run's FROZEN snapshot, so it makes "how the builds
// differed" visible without ever re-resolving a live config.
export async function compareRunsAction(codes: string[]): Promise<CompareData> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to compare runs.");
  const clean = codes.filter((c) => typeof c === "string" && c.length > 0);
  if (clean.length < 2) throw new Error("Select at least two runs to compare.");
  return compareTestRuns(user.orgId, clean.slice(0, 6));
}
