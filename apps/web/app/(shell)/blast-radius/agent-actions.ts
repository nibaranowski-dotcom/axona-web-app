"use server";

import { getBlastRadiusView } from "@/lib/blast-radius";
import type { TraceType } from "@/lib/blast-radius-shared";
import {
  recordAgentReview,
  type AgentReviewResult,
} from "@/app/(shell)/agent-review/actions";

// DEMO.6 #5 — confirm (or dismiss) the agent's computed affected-units set.
// Mutates nothing: the set is a live traversal, not stored state, and the ECO's own
// release stays behind decide("eco.release"). This records that a human agreed the
// blast set is right — the CONF.1 label — and fires LOOP.1.
export async function reviewBlastRadiusAction(
  ecoCode: string,
  upheld: boolean,
): Promise<AgentReviewResult> {
  return recordAgentReview({
    kind: "blast.review",
    code: ecoCode,
    resolve: async (orgId) =>
      (await getBlastRadiusView(orgId, "eco" as TraceType, ecoCode)).agent,
    upheld,
    agentLabel: "Blast-radius agent",
    targetType: "ECO",
    revalidate: ["/blast-radius", `/changes/${ecoCode}`],
    subject: "affected-set computation",
  });
}
