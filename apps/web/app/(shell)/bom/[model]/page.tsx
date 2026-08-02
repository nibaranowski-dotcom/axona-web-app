import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { getBomView } from "@/lib/bom";
import { BomView } from "@/components/bom/BomView";
import { ScreenShell, ScreenMessage } from "@/components/shell/ScreenShell";

// /bom/:model (PLM.13 · `BOM.dc.html`) — the as-designed bill of materials for one
// product model at a chosen design revision: the multi-level tree, the revision
// ladder that produced it, and the per-part expand that deep-links to Inventory and
// to the change orders that touch the part. The as-designed side of the
// as-designed-vs-as-built story (PLM.4 is the diff). Org-scoped via getBomView →
// dbForOrg. Revision + expanded position are URL state, so every view is a link.
export const dynamic = "force-dynamic";

export default async function BomPage({
  params,
  searchParams,
}: {
  params: { model: string };
  searchParams?: { rev?: string; position?: string };
}) {
  const modelCode = decodeURIComponent(params.model);
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ScreenShell header={<Header code={modelCode} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            Sign in to view this bill of materials.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  const data = await getBomView(user.orgId, modelCode, {
    rev: searchParams?.rev,
    position: searchParams?.position,
  });
  if (!data) {
    return (
      <ScreenShell header={<Header code={modelCode} />}>
        <ScreenMessage>
          <p className="text-sm text-ink-muted">
            No product model <span className="font-mono">{modelCode}</span> in
            this workspace.
          </p>
        </ScreenMessage>
      </ScreenShell>
    );
  }

  return (
    <BomView data={data} canImport={hasRole(user, ["ENGINEER", "ADMIN"])} />
  );
}

function Header({ code }: { code: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
        Engineering · BOM
      </div>
      <h1 className="mt-0.5 font-mono text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {code}
      </h1>
    </div>
  );
}
