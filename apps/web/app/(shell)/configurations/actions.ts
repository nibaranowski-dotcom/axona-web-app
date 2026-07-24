"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";
import { compareConfigs, type ConfigDiff } from "@/lib/configurations";

// PLM.10 — lock/baseline a configuration through decide("config.lock") (RBAC-gated
// + audited). A locked config is immutable (decide refuses a second lock). Compare
// is read-only (org-scoped).

export async function lockConfigAction(configId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to lock a configuration.");
  const res = await decide("config.lock", configId, "APPROVE", user);
  if (!res.ok) throw new Error(res.message);
  revalidatePath("/configurations");
}

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
