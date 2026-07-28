"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";
import { compareConfigs, type ConfigDiff } from "@/lib/configurations";

// PLM.11 — the Configuration detail's gated actions. Lock/unlock route through
// decide() (RBAC-gated + audited); both are DUAL-APPROVER (a single approver can't
// finalize a lock; the locker can't unlock their own baseline). Compare is read-only.

/** Propose or finalize a lock via decide("config.lock"). Returns the resulting status
 *  ("awaiting_second" | "locked") so the UI can reflect the dual-approver step. */
export async function lockConfigAction(
  configId: string,
): Promise<{ status: string; summary: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to lock a configuration.");
  const res = await decide("config.lock", configId, "APPROVE", user);
  if (!res.ok) throw new Error(res.message);
  revalidatePath(`/configurations`);
  return { status: res.status, summary: res.summary };
}

/** Unlock a baseline via decide("config.unlock") — a second approver (not the locker). */
export async function unlockConfigAction(
  configId: string,
): Promise<{ status: string; summary: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to unlock a configuration.");
  const res = await decide("config.unlock", configId, "APPROVE", user);
  if (!res.ok) throw new Error(res.message);
  revalidatePath(`/configurations`);
  return { status: res.status, summary: res.summary };
}

/** Diff two configuration versions (read-only, org-scoped) — reuses compareConfigs. */
export async function compareConfigsAction(
  a: string,
  b: string,
): Promise<ConfigDiff> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to compare.");
  const diff = await compareConfigs(user.orgId, a, b);
  if (!diff) throw new Error("One or both configurations were not found.");
  return diff;
}
