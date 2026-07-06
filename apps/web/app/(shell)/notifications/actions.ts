"use server";

import { revalidatePath } from "next/cache";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// NOTIF.1 — mark-read actions. Own-user + broadcasts only, org-scoped. markRead is
// the ONLY content mutation; everything else is read-only.
export interface NotifActionResult {
  ok: boolean;
}

export async function markRead(id: string): Promise<NotifActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const db = dbForOrg(user.orgId);
  // only a row the user is allowed to see (own or broadcast)
  await db.notification.updateMany({
    where: { id, OR: [{ userId: user.id }, { userId: null }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<NotifActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const db = dbForOrg(user.orgId);
  await db.notification.updateMany({
    where: { readAt: null, OR: [{ userId: user.id }, { userId: null }] },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true };
}
