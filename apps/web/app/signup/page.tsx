import { SignupForm } from "@/components/auth/SignupForm";

// /signup (AUTH.4) — full-screen, outside the app shell. Public route (middleware
// allowlist). Provisions a new Org + first ADMIN, then auto signs-in. 1:1 with
// Signup.dc.html on the v2 tokens.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm />;
}
