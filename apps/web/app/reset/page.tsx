import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

// /reset (AUTH.7) — request a password reset. Public, full-screen.
export const dynamic = "force-dynamic";
export default function ResetPage() {
  return <ResetRequestForm />;
}
