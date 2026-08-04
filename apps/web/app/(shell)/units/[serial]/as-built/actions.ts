"use server";

import { getAsBuiltView } from "@/lib/as-built";
import {
  recordAgentReview,
  type AgentReviewResult,
} from "@/app/(shell)/agent-review/actions";

// DEMO.6 #2 — acknowledge (or dismiss) the genealogy agent's as-built drift flag.
// Mutates nothing: an as-built capture is a record of what WAS built and must never
// be edited by an acknowledgement. The verdict lands in AUDIT.1 with the proposal's
// model + confidence and fires LOOP.1. The proposal is re-resolved server-side from
// the same read model the screen rendered — never taken from the client.
export async function reviewAsBuiltDriftAction(
  serial: string,
  upheld: boolean,
): Promise<AgentReviewResult> {
  return recordAgentReview({
    kind: "asbuilt.review",
    code: serial,
    resolve: async (orgId) =>
      (await getAsBuiltView(orgId, serial))?.agent ?? null,
    upheld,
    agentLabel: "As-built genealogy agent",
    targetType: "Unit",
    revalidate: [`/units/${serial}/as-built`, `/units/${serial}`],
    subject: "drift flag",
  });
}
