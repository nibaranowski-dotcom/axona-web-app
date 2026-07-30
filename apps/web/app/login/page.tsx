import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { googleSsoEnabled } from "@/auth";

// /login (AUTH.1) — full-screen, outside the app shell. Public route (the
// middleware lets it through; an authenticated user hitting it is bounced to /).
// Built 1:1 to Login.dc.html on the v2 tokens.
//
// AUTH.SSO — pass whether Google is configured (env) so the button renders enabled
// (→ signIn("google")) only when it can actually work; otherwise a disabled
// placeholder. Read server-side; secrets never reach the client.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={googleSsoEnabled} />
    </Suspense>
  );
}
