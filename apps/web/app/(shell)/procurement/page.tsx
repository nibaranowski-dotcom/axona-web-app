import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getProcurementQueue, getPoDetail } from "@/lib/procurement";
import { hasRole } from "@/lib/rbac";
import { getFocusedRecord } from "@/lib/connected-objects";
import { FocusedRecord } from "@/components/ontology/FocusedRecord";
import { PoDetail } from "@/components/procurement/PoDetail";
import {
  ProcurementView,
  type ProcurementData,
} from "@/components/procurement/ProcurementView";

// /procurement (build-spec §4.10) — the wedge screen: the PO-queue signature
// artifact + the agent's reorder recommendation + human approval. Data from
// PROC.1 (getProcurementQueue, org-scoped). Static shell route → precedence over
// (shell)/[module].
export const dynamic = "force-dynamic";

const EMPTY: ProcurementData = {
  pos: [],
  reorderCandidates: [],
  agentCount: 0,
  canApprove: false,
  traceLines: [],
};

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams?: { focus?: string | string[] };
}) {
  const user = await getCurrentUser();
  if (!user) return <ProcurementView data={EMPTY} />;

  try {
    const db = dbForOrg(user.orgId);
    const [{ pos, reorderCandidates }, agentCount, latestRun] =
      await Promise.all([
        getProcurementQueue(user.orgId, {}),
        db.agent.count({ where: { moduleKey: "procurement" } }),
        db.agentRun.findFirst({
          where: { agent: { moduleKey: "procurement", orgId: user.orgId } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const traceLines = Array.isArray(latestRun?.trace)
      ? (latestRun.trace as { ts?: string; kind?: string; text?: string }[])
      : [];

    // DEMO.6 #10 — LINK.1 arrival point for a reorder PO reached from the fault loop.
    const focused = await getFocusedRecord(
      user.orgId,
      "PURCHASE_ORDER",
      searchParams?.focus,
      async (code) => {
        const po = await db.purchaseOrder.findFirst({
          where: { code },
          select: { status: true, qty: true, part: { select: { sku: true } } },
        });
        return po
          ? `${po.status} · ${po.qty}x ${po.part?.sku ?? "part"}`
          : null;
      },
    );
    // DEMO beats 2 & 3 — the focused PO's own detail (agent chase / 3-way match).
    // Same `?focus=` param the LINK.2 arrival surface already uses, so a row click and
    // a graph hop land identically. Org-scoped: getPoDetail returns null for a code
    // that is not this tenant's.
    const focusCode = Array.isArray(searchParams?.focus)
      ? searchParams?.focus[0]
      : searchParams?.focus;
    const poDetail = focusCode
      ? await getPoDetail(user.orgId, focusCode)
      : null;

    return (
      <>
        {poDetail && <PoDetail detail={poDetail} />}
        {focused && (
          <FocusedRecord
            type={focused.type}
            code={focused.code}
            label={focused.label}
            groups={focused.groups}
            basePath="/procurement"
          />
        )}
        <ProcurementView
          data={{
            pos,
            reorderCandidates,
            agentCount,
            canApprove: hasRole(user, ["OPS", "ADMIN"]),
            traceLines,
          }}
        />
      </>
    );
  } catch {
    return <ProcurementView data={EMPTY} error />;
  }
}
