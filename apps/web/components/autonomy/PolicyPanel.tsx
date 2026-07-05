import {
  approvePolicyRollback,
  rejectPolicyRollback,
} from "@/app/(shell)/autonomy/actions";
import type { PolicyVersion } from "@/lib/autonomy";

// Autonomy policy panel (Autonomy.dc.html) — the deployed policy versions with
// their state (current = green · canary = lime · standby = neutral), carried by a
// dot + ink text (AA-safe). A non-standby version (a regressed canary/current)
// exposes the role-gated ROLLBACK approval (RBAC.5: Approve rollback / Reject via
// the shared decide() primitive — audited; a version reaches "standby" only via a
// human, TECH/ADMIN). Roll-forward (policy.promote) is a deferred kind. Brand
// palette only.
const STATE: Record<string, { dot: string; label: string }> = {
  current: { dot: "bg-success", label: "Current" },
  canary: { dot: "bg-accent", label: "Canary" },
  standby: { dot: "bg-line-strong", label: "Standby" },
};

export function PolicyPanel({
  policies,
  canManage,
}: {
  policies: PolicyVersion[];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-paper p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Autonomy policy</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
          Deployed
        </span>
      </div>
      {policies.length === 0 ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          No policy versions.
        </p>
      ) : (
        policies.map((p) => {
          const meta = STATE[p.state.toLowerCase()] ?? {
            dot: "bg-line-strong",
            label: p.state,
          };
          // The rollback candidate is a canary under evaluation (e.g. a regressed
          // Site-3 cohort). The server still enforces isPending (state !== standby).
          const pendingRollback = p.state.toLowerCase() === "canary";
          return (
            <div key={p.id} className="border-t border-line py-3">
              <div className="flex items-center justify-between gap-[10px]">
                <div className="min-w-0">
                  <div className="font-mono text-[13px] font-semibold text-ink">
                    {p.version}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    {p.note}
                  </div>
                </div>
                <span className="inline-flex flex-none items-center gap-1.5 text-[11px] font-semibold text-ink">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-pill ${meta.dot}`}
                  />
                  {meta.label}
                </span>
              </div>
              {pendingRollback && canManage && (
                <div className="mt-2.5 flex gap-2">
                  <form action={approvePolicyRollback.bind(null, p.id)}>
                    <button
                      type="submit"
                      className="rounded-btn bg-ink-strong px-3 py-1.5 text-[12px] font-semibold text-on-dark transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Approve rollback
                    </button>
                  </form>
                  <form action={rejectPolicyRollback.bind(null, p.id)}>
                    <button
                      type="submit"
                      className="rounded-btn border border-line-strong bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
