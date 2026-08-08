import { dbForOrg } from "@axona/db";

// SIDEBAR.2 — per-user shell UI preferences, stored on `User.uiPrefs` (Json?).
//
// The sidebar's collapse state used to live only in a client zustand store persisted
// to localStorage. That is per-BROWSER, not per-user: the same person got a different
// shell on a second machine, and the first paint always rendered expanded and then
// snapped to the saved shape — a visible flash on every navigation.
//
// These prefs are read on the server and passed into the shell, so the sidebar renders
// in its saved shape immediately. Reads and writes go through `dbForOrg`, so a user can
// only ever touch their own org's rows (ISO.1).
//
// Everything here is DEFENSIVE about shape: `uiPrefs` is free-form Json that older
// rows do not have at all, so a missing, null or malformed value must degrade to the
// default shell rather than throw inside a layout that renders every screen.

export interface ShellUiPrefs {
  /** the 64px icon rail instead of the 272px expanded sidebar. */
  sidebarCollapsed: boolean;
  /**
   * Which nav groups are open, by group label. A group ABSENT from the map is open —
   * the default shape is "everything expanded", so a fresh user sees the whole nav
   * and only explicit collapses are stored.
   */
  navGroupsClosed: string[];
}

export const DEFAULT_UI_PREFS: ShellUiPrefs = {
  sidebarCollapsed: false,
  navGroupsClosed: [],
};

/** Coerce whatever is in the Json column into a usable shape. Never throws. */
export function parseUiPrefs(raw: unknown): ShellUiPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_UI_PREFS };
  const o = raw as Record<string, unknown>;
  return {
    sidebarCollapsed: o.sidebarCollapsed === true,
    navGroupsClosed: Array.isArray(o.navGroupsClosed)
      ? o.navGroupsClosed.filter((g): g is string => typeof g === "string")
      : [],
  };
}

/**
 * Read one user's shell prefs. Org-scoped; returns the defaults for a user with no
 * stored prefs (the common case — nothing is written until they touch the sidebar).
 */
export async function getUiPrefs(
  orgId: string,
  userId: string,
): Promise<ShellUiPrefs> {
  try {
    const db = dbForOrg(orgId);
    const row = await db.user.findFirst({
      where: { id: userId },
      select: { uiPrefs: true },
    });
    return parseUiPrefs(row?.uiPrefs ?? null);
  } catch {
    // The shell layout renders EVERY screen. A prefs read is presentation state —
    // it must never be able to take the app down.
    return { ...DEFAULT_UI_PREFS };
  }
}

/**
 * Persist a partial update, merged over what is stored. Org-scoped by `dbForOrg`, and
 * the write is additionally pinned to the user's own id — a caller cannot write
 * another user's prefs even within the same org.
 */
export async function setUiPrefs(
  orgId: string,
  userId: string,
  patch: Partial<ShellUiPrefs>,
): Promise<ShellUiPrefs> {
  const db = dbForOrg(orgId);
  const current = await getUiPrefs(orgId, userId);
  const next: ShellUiPrefs = {
    sidebarCollapsed: patch.sidebarCollapsed ?? current.sidebarCollapsed,
    navGroupsClosed: patch.navGroupsClosed ?? current.navGroupsClosed,
  };
  await db.user.updateMany({
    where: { id: userId },
    data: { uiPrefs: next as unknown as object },
  });
  return next;
}
