"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { provisionWorkspace, type ProvisionResult } from "@/lib/provisioning";
import { sendVerificationEmail } from "@/lib/auth-tokens";

// AUTH.4 — the PUBLIC provisioning action. Validates + creates Org + first ADMIN
// (bcrypt), then auto signs-in the new user and redirects to /onboarding (thin
// redirect to /core until AUTH.6). A field error (email taken, weak password) is
// returned to the form — never a 500, never a leak. Server-only ("use server").
export interface SignupState {
  error?: { field: "email" | "form"; message: string };
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const input = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    orgName: String(formData.get("orgName") ?? ""),
    industry: (formData.get("industry") as string) || undefined,
  };

  const result: ProvisionResult = await provisionWorkspace(input);
  if (!result.ok) {
    return { error: { field: result.field, message: result.message } };
  }

  // AUTH.7 — send an email-verification link (soft/non-blocking). Best-effort.
  await sendVerificationEmail(result.userId, input.email.toLowerCase().trim());

  // Auto sign-in the freshly-created ADMIN (credentials → JWT session). redirect
  // is thrown by signIn on success, so control leaves here.
  await signIn("credentials", {
    email: input.email.toLowerCase().trim(),
    password: input.password,
    redirectTo: "/onboarding",
  });

  // Unreachable on success (signIn redirects); a defensive fallback.
  redirect("/onboarding");
}
