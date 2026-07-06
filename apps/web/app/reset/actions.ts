"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { requestPasswordReset, completePasswordReset } from "@/lib/auth-tokens";

// AUTH.7 — public reset actions. Request is anti-enumeration (always the same
// confirmation). Complete re-hashes, marks the token used, bumps tokenVersion, and
// signs the user in → /core.
export interface ResetRequestState {
  sent?: boolean;
}
export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "");
  await requestPasswordReset(email); // silent whether or not the user exists
  return { sent: true }; // ALWAYS the same confirmation
}

export interface SetPasswordState {
  error?: string;
}
export async function setNewPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const res = await completePasswordReset(token, password);
  if (!res.ok) return { error: res.message };
  // sign in with the new password → /core (old sessions were invalidated).
  await signIn("credentials", {
    email: res.email,
    password,
    redirectTo: "/core",
  });
  redirect("/core");
}
