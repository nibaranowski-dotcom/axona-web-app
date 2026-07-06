import Link from "next/link";
import { loadResetToken } from "@/lib/auth-tokens";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetNewPasswordForm } from "@/components/auth/SetNewPasswordForm";

// /reset/:token (AUTH.7) — set a new password. Invalid/expired/used → clean state.
export const dynamic = "force-dynamic";
export default async function ResetTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const res = await loadResetToken(params.token);
  if (!res.ok) {
    return (
      <AuthCard
        ariaLabel="Reset password"
        subtitle="Reset your password"
        title="This link is no longer valid"
      >
        <p className="text-center text-[13px] leading-[1.5] text-ink-muted">
          Reset links expire after 1 hour and can only be used once. Request a
          fresh one to continue.
        </p>
        <Link
          href="/reset"
          className="mt-5 block text-center text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-60"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }
  return <SetNewPasswordForm token={params.token} email={res.email} />;
}
