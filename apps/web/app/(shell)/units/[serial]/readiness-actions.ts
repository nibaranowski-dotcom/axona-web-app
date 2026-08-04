"use server";

import { getUnitDetail } from "@/lib/unit-detail";
import {
  recordAgentReview,
  type AgentReviewResult,
} from "@/app/(shell)/agent-review/actions";

// DEMO.6 #11 — confirm the readiness agent's proposed next action. Mutates nothing:
// expediting or raising an order is a procurement action behind its own gated kind.
// This records that a human agreed the proposed action is the right one.
export async function reviewReadinessAction(
  serial: string,
  upheld: boolean,
): Promise<AgentReviewResult> {
  return recordAgentReview({
    kind: "readiness.review",
    code: serial,
    resolve: async (orgId) =>
      (await getUnitDetail(orgId, serial))?.readinessAgent ?? null,
    upheld,
    agentLabel: "Build-readiness agent",
    targetType: "Unit",
    revalidate: [`/units/${serial}`],
    subject: "next-action proposal",
  });
}
