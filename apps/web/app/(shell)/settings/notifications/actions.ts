"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { NOTIFICATION_EVENTS, type PrefsMap } from "@/lib/notification-prefs";

// SET.4 — save notification preferences. OWN-USER only (a user only edits their
// own prefs), org-scoped, Zod-validated. Personal preference — no audit needed.

const channelSchema = z.object({ inApp: z.boolean(), email: z.boolean() });
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM or empty

export interface PrefsActionResult {
  ok: boolean;
  message?: string;
}

export async function updatePrefs(input: {
  prefs: PrefsMap;
  muted: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
}): Promise<PrefsActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  // validate the matrix against the known events
  const shape = z.object({
    prefs: z.record(channelSchema),
    muted: z.boolean(),
    quietStart: z.string().regex(timeRe).nullable().optional(),
    quietEnd: z.string().regex(timeRe).nullable().optional(),
  });
  const parsed = shape.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid preferences." };

  // keep only known event keys
  const clean: PrefsMap = {};
  for (const e of NOTIFICATION_EVENTS) {
    clean[e.key] = parsed.data.prefs[e.key] ?? { inApp: true, email: false };
  }

  const db = dbForOrg(user.orgId);
  await db.notificationPref.upsert({
    where: { userId: user.id }, // own user only
    update: {
      prefs: clean,
      muted: parsed.data.muted,
      quietStart: parsed.data.quietStart ?? null,
      quietEnd: parsed.data.quietEnd ?? null,
    },
    create: {
      userId: user.id,
      orgId: user.orgId,
      prefs: clean,
      muted: parsed.data.muted,
      quietStart: parsed.data.quietStart ?? null,
      quietEnd: parsed.data.quietEnd ?? null,
    },
  });
  revalidatePath("/settings/notifications");
  revalidatePath("/notifications");
  revalidatePath("/", "layout"); // the shell unread badge
  return { ok: true };
}
