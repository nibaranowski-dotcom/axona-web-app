import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUnitDetail } from "@/lib/unit-detail";
import { getConnectedObjects } from "@/lib/connected-objects";
import { UnitView } from "@/components/units/UnitView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /units/:serial (PLM.3 · `Unit.dc.html`) — THE hero object. Identity + the
// configuration resolved NOW + the as-built divergence + a lifecycle timeline
// where every event carries the config that was live AT THAT EVENT. Org-scoped
// via getUnitDetail → dbForOrg; a serial from another tenant is a 404, not a leak.
export const dynamic = "force-dynamic";

export default async function UnitPage({
  params,
}: {
  params: { serial: string };
}) {
  const user = await getCurrentUser();
  const serial = decodeURIComponent(params.serial);

  if (!user) {
    return (
      <ScreenShell header={<Header serial={serial} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">Sign in to view this unit.</p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const unit = await getUnitDetail(user.orgId, serial);
  if (!unit) notFound();

  const connected = await getConnectedObjects(user.orgId, "UNIT", serial);
  return <UnitView unit={unit} connected={connected} />;
}

function Header({ serial }: { serial: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Engineering · PLM
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {serial}
      </h1>
    </div>
  );
}
