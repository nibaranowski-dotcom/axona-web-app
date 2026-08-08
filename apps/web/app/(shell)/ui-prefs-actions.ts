"use server";

import { getCurrentUser } from "@/lib/session";
import { setUiPrefs, type ShellUiPrefs } from "@/lib/ui-prefs";

// SIDEBAR.2 — the write half of per-user shell prefs.
//
// Deliberately NOT revalidating: collapsing the sidebar is presentation state, and
// re-rendering the whole shell on every toggle would make the interaction feel heavy.
// The client applies the change optimistically and this persists it for the next SSR.
//
// The user is resolved from the SESSION, never from an argument — a caller cannot
// name whose prefs to write, so this cannot be pointed at another user or org.
export async function saveShellUiPrefs(
  patch: Partial<ShellUiPrefs>,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return; // signed out mid-session — nothing to persist, never an error
  try {
    await setUiPrefs(user.orgId, user.id, patch);
  } catch {
    // Presentation state. A failed write must not surface as an error in the shell;
    // the UI keeps the user's choice for this session and re-tries on the next toggle.
  }
}
