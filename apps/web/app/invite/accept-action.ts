"use server";

import { signIn } from "@/auth";
import { acceptInvite, type AcceptResult } from "@/lib/invites";

// AUTH.5 — public accept action. Validates + creates the User at the invited role
// (one race-safe txn in acceptInvite), then auto signs-in and lands on /core (the
// org is already onboarded — invitees skip the wizard). Field errors are returned;
// success throws the signIn redirect.
export interface AcceptState {
  error?: string;
}

export async function acceptInviteAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const result: AcceptResult = await acceptInvite({
    token,
    name: String(formData.get("name") ?? ""),
    password,
  });
  if (!result.ok) return { error: result.message };

  // Auto sign-in the newly-created user (credentials → JWT session).
  await signIn("credentials", {
    email: result.email,
    password,
    redirectTo: "/core",
  });
  return {};
}
