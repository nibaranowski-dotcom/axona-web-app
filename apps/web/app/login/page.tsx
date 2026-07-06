import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

// /login (AUTH.1) — full-screen, outside the app shell. Public route (the
// middleware lets it through; an authenticated user hitting it is bounced to /).
// Built 1:1 to Login.dc.html on the v2 tokens.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
