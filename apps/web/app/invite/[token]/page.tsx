import Link from "next/link";
import { loadInvite } from "@/lib/invites";
import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";

// /invite/:token (AUTH.5) — public accept screen (middleware allows /invite/*).
// A valid PENDING invite renders the join form 1:1 to Accept Invite.dc.html; an
// invalid / revoked / accepted / expired token renders a clean "no longer valid"
// state with a link to /login. Never 500.
export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const res = await loadInvite(params.token);
  if (!res.ok) return <InviteInvalid />;
  return <AcceptInviteForm invite={res.invite} />;
}

function InviteInvalid() {
  return (
    <main
      aria-label="Invite"
      className="flex min-h-dvh items-center justify-center bg-panel px-8 py-12 font-sans text-ink"
    >
      <div className="w-full max-w-[440px] rounded-[20px] border border-line bg-paper px-10 py-10 text-center">
        <div className="mb-6 flex justify-center">
          <span className="text-[21px] font-bold tracking-[-0.045em] text-ink-strong">
            axona
          </span>
        </div>
        <h1 className="text-[18px] font-semibold text-ink">
          This invite is no longer valid.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
          It may have expired, been revoked, or already been used. Ask your
          admin for a fresh invite, or log in if you already have an account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-[9px] border border-line-strong bg-paper px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Go to log in
        </Link>
      </div>
    </main>
  );
}
