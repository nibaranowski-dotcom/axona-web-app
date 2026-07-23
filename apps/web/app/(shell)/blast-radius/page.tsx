import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getBlastRadiusView, type TraceType } from "@/lib/blast-radius";
import { BlastRadiusView } from "@/components/units/BlastRadiusView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /blast-radius (PLM.5 · `Blast Radius.dc.html`) — the UI over the ONT.1
// traversal. Trace from a lot · sw version · ECO · part revision; results grouped
// by module with the relation path that reached each record. Unit rows link to
// /units/:serial. Org-scoped via getBlastRadiusView → dbForOrg.
export const dynamic = "force-dynamic";

const TYPES = new Set<TraceType>(["lot", "sw", "eco", "part"]);

export default async function BlastRadiusPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ScreenShell
        header={
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Engineering · PLM · traceability
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Blast radius
            </h1>
          </div>
        }
      >
        <ScreenMessage>
          <p className="text-sm text-ink-muted">Sign in to trace impact.</p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const one = (k: string): string | undefined => {
    const v = searchParams?.[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.length > 0 ? s : undefined;
  };
  const raw = one("type") ?? "lot";
  const type: TraceType = TYPES.has(raw as TraceType)
    ? (raw as TraceType)
    : "lot";

  const data = await getBlastRadiusView(user.orgId, type, one("value") ?? null);

  return (
    <BlastRadiusView
      data={data}
      canHandOff={hasRole(user, ["OPS", "ADMIN", "ENGINEER"])}
    />
  );
}
