import { getCurrentUser } from "@/lib/session";
import {
  getChangeOrders,
  type ChangeStatus,
  type ChangeOrdersFilter,
} from "@/lib/change-orders";
import { ChangeOrdersView } from "@/components/changes/ChangeOrdersView";

// /changes (PLM.12 · `Change Orders.dc.html`) — the change queue. Answers Q5 at fleet
// scale: proposed / in review / approved / released, what each touches (the SHARED
// ONT.1 blast-radius traversal), and "what's awaiting MY approval" (first-class,
// server-side per-user query). Filters compose SERVER-SIDE via the URL. The list ROUTES
// to the detail (PLM.9); approval stays gated on the detail. Org-scoped via dbForOrg.
export const dynamic = "force-dynamic";

const STATUSES: ChangeStatus[] = ["draft", "in_review", "approved", "released"];
const CLASSES = ["SUPERSEDE", "REVISE", "DEVIATION"];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ChangeOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; awaiting?: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <ChangeOrdersView
        data={{
          rows: [],
          stats: {
            awaitingMe: 0,
            draft: 0,
            inReview: 0,
            approved: 0,
            released: 0,
            total: 0,
          },
          total: 0,
          awaitingMeActive: false,
        }}
        active={{}}
      />
    );
  }

  const statusParam = one(searchParams.status);
  const typeParam = one(searchParams.type)?.toUpperCase();
  const awaiting = one(searchParams.awaiting) === "me";

  const filter: ChangeOrdersFilter = {
    status: STATUSES.includes(statusParam as ChangeStatus)
      ? (statusParam as ChangeStatus)
      : undefined,
    changeClass: CLASSES.includes(typeParam ?? "") ? typeParam : undefined,
    awaitingMe: awaiting,
  };

  const data = await getChangeOrders(user.orgId, filter, user.id);
  return (
    <ChangeOrdersView
      data={data}
      active={{
        status: filter.status,
        type: filter.changeClass,
        awaiting: filter.awaitingMe,
      }}
    />
  );
}
