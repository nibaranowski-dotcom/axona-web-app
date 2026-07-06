import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth-tokens";
import { AuthCard } from "@/components/auth/AuthCard";

// /verify/:token (AUTH.7) — consume a verify token → mark the email verified.
export const dynamic = "force-dynamic";
export default async function VerifyPage({
  params,
}: {
  params: { token: string };
}) {
  const res = await verifyEmailToken(params.token);
  return res.ok ? (
    <AuthCard
      ariaLabel="Email verified"
      subtitle="Email verification"
      title="Email verified"
    >
      <p className="text-center text-[13px] leading-[1.5] text-ink-muted">
        Thanks — your email is confirmed. You’re all set.
      </p>
      <Link
        href="/core"
        className="mt-5 block text-center text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-60"
      >
        Go to the Command Center
      </Link>
    </AuthCard>
  ) : (
    <AuthCard
      ariaLabel="Email verification"
      subtitle="Email verification"
      title="This link is no longer valid"
    >
      <p className="text-center text-[13px] leading-[1.5] text-ink-muted">
        Verification links expire after 24 hours and can only be used once. Ask
        for a new one from your profile.
      </p>
      <Link
        href="/login"
        className="mt-5 block text-center text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-60"
      >
        Back to log in
      </Link>
    </AuthCard>
  );
}
