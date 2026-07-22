import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAsBuiltView } from "@/lib/as-built";
import { AsBuiltDiffView } from "@/components/units/AsBuiltDiffView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /units/:serial/as-built (PLM.4 · `As-Built Diff.dc.html`) — answers Q1: "the
// same robot is not actually the same." As-designed BOM aligned to the captured
// as-built records BY POSITION. Org-scoped via getAsBuiltView → dbForOrg.
export const dynamic = "force-dynamic";

export default async function AsBuiltPage({
  params,
}: {
  params: { serial: string };
}) {
  const user = await getCurrentUser();
  const serial = decodeURIComponent(params.serial);

  if (!user) {
    return (
      <ScreenShell
        header={
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
              Engineering · PLM
            </div>
            <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
              As-built diff
            </h1>
          </div>
        }
      >
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            Sign in to view this unit’s as-built record.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const data = await getAsBuiltView(user.orgId, serial);
  if (!data) notFound();

  return <AsBuiltDiffView data={data} />;
}
