import type { AccessGrant } from "@/lib/security";

// Fleet command access (Security.dc.html) — who/what can issue commands to the
// fleet. Flag via a dot + ink text (AA-safe): verified/scoped/signed = green,
// revoked = ink. Read-only — revoke/rotate/grant are agent-proposed only. Brand
// palette only.
//
// Note: derived stand-in — there is no Access-management model (see SEC.2 notes).
export function AccessPanel({ grants }: { grants: AccessGrant[] }) {
  return (
    <div className="rounded-card border border-line bg-paper p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          Fleet command access
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Can issue commands
        </span>
      </div>
      {grants.map((a) => (
        <div
          key={`${a.kind}-${a.name}`}
          className="flex items-center justify-between gap-[10px] border-t border-line py-[11px]"
        >
          <div className="flex min-w-0 items-center gap-[9px]">
            <span className="flex-none rounded-[5px] border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.04em] text-ink-muted">
              {a.kind}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-ink">
                {a.name}
              </div>
              <div className="mt-px truncate font-mono text-[9.5px] text-ink-muted">
                {a.scope}
              </div>
            </div>
          </div>
          <span className="inline-flex flex-none items-center gap-1.5 text-[10.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${a.ok ? "bg-success" : "bg-ink-strong"}`}
            />
            {a.flag}
          </span>
        </div>
      ))}
    </div>
  );
}
