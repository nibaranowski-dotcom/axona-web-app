"use server";

import { getInventoryData } from "@/lib/inventory";
import {
  recordAgentReview,
  type AgentReviewResult,
} from "@/app/(shell)/agent-review/actions";

// DEMO.6 #7 — confirm the reorder agent's min-breach finding. Deliberately does NOT
// approve the purchase order: that is money, and money stays behind
// decide("po.approve") with its own role gate. Confirming records that a human agreed
// the shortage is real; the buyer still approves the PO on /procurement.
export async function reviewReorderAction(
  sku: string,
  upheld: boolean,
): Promise<AgentReviewResult> {
  return recordAgentReview({
    kind: "inventory.review",
    code: sku,
    resolve: async (orgId) => (await getInventoryData(orgId)).agent,
    upheld,
    agentLabel: "Reorder agent",
    targetType: "Part",
    revalidate: ["/inventory", "/procurement"],
    subject: "shortage finding",
  });
}
