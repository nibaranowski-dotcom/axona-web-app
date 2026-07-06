"use server";

import { redirect } from "next/navigation";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { ONBOARDING_MODULE_KEYS, ALWAYS_ON } from "@/lib/onboarding";

// AUTH.6 — onboarding wizard server actions. ADMIN-gated (requireRole) + org-scoped
// (dbForOrg on the acting user's own org only). Step 2 (Team) is collect-only in
// the client — no live invites here (that's AUTH.5); nothing is persisted for it.

// Step 1 — save the org profile (name / industry). ADMIN-only.
export async function saveProfile(input: {
  name: string;
  industry?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]); // line 1 — before any DB call
  const name = input.name.trim();
  if (!name) return;
  const db = dbForOrg(user!.orgId);
  await db.org.updateMany({
    where: { id: user!.orgId },
    data: { name, industry: input.industry?.trim() || null },
  });
}

// Step 3 / Finish — persist the enabled modules + stamp onboardedAt, then land on
// the Command Center. `core` is always enabled; unknown keys are dropped.
export async function finishOnboarding(enabledKeys: string[]): Promise<void> {
  const user = await getCurrentUser();
  requireRole(user, ["ADMIN"]);
  const chosen = enabledKeys.filter((k) => ONBOARDING_MODULE_KEYS.includes(k));
  const enabledModules = Array.from(new Set([...ALWAYS_ON, ...chosen]));
  const db = dbForOrg(user!.orgId);
  await db.org.updateMany({
    where: { id: user!.orgId },
    data: { enabledModules, onboardedAt: new Date() },
  });
  redirect("/core");
}
