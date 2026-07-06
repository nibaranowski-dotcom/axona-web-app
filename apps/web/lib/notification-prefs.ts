import { prisma, type NotificationType } from "@axona/db";

// SET.4 — notification preferences (server-only). The event × channel matrix a user
// controls. NOTIF.1's in-app feed respects `inApp` + `muted` now; `email` is stored
// and honored by NOTIF.3 delivery.

export interface EventDef {
  key: string;
  label: string;
  description: string;
  type: NotificationType; // maps to a NOTIF.1 type
}

export const NOTIFICATION_EVENTS: EventDef[] = [
  {
    key: "approvals",
    label: "Approvals awaiting you",
    description: "A gate needs your decision.",
    type: "APPROVAL",
  },
  {
    key: "exceptions",
    label: "Cross-module exceptions",
    description: "Something broke the through-line.",
    type: "EXCEPTION",
  },
  {
    key: "runs",
    label: "Agent run failures",
    description: "A run parked or failed.",
    type: "RUN",
  },
  {
    key: "digest",
    label: "Weekly digest",
    description: "A summary of the week.",
    type: "SYSTEM",
  },
  {
    key: "mentions",
    label: "Mentions",
    description: "Someone mentioned you.",
    type: "MENTION",
  },
];

export interface ChannelPref {
  inApp: boolean;
  email: boolean;
}
export type PrefsMap = Record<string, ChannelPref>;

export interface NotificationPrefs {
  prefs: PrefsMap;
  muted: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

// Sensible defaults: everything in-app on; email on for approvals + exceptions.
export function defaultPrefs(): PrefsMap {
  const map: PrefsMap = {};
  for (const e of NOTIFICATION_EVENTS) {
    map[e.key] = {
      inApp: true,
      email: e.key === "approvals" || e.key === "exceptions",
    };
  }
  return map;
}

export async function getNotificationPrefs(
  userId: string,
): Promise<NotificationPrefs> {
  const row = await prisma.notificationPref.findUnique({ where: { userId } });
  if (!row) {
    return {
      prefs: defaultPrefs(),
      muted: false,
      quietStart: null,
      quietEnd: null,
    };
  }
  // merge stored over defaults so newly-added events get a default
  const stored = (row.prefs as unknown as PrefsMap) ?? {};
  const merged: PrefsMap = { ...defaultPrefs(), ...stored };
  return {
    prefs: merged,
    muted: row.muted,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}

// Which NOTIF.1 types are suppressed in-app for this user (muted → all; per-event
// inApp=false → that type). Used by getNotifications.
export async function suppressedInAppTypes(
  userId: string,
): Promise<Set<NotificationType>> {
  const { prefs, muted } = await getNotificationPrefs(userId);
  if (muted) return new Set(NOTIFICATION_EVENTS.map((e) => e.type));
  const off = new Set<NotificationType>();
  for (const e of NOTIFICATION_EVENTS) {
    if (prefs[e.key]?.inApp === false) off.add(e.type);
  }
  return off;
}
