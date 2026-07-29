"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { updateLeadStatus } from "@/lib/leads";
import type { LeadStatus } from "@axona/db";

// LEAD.1 — the Leads view's only mutation: advance a lead's triage status. ADMIN-gated
// server-side (defense in depth — the page also gates). No other lead mutation exists
// on this surface; the public endpoint never routes through here.

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"];

export async function setLeadStatusAction(
  id: string,
  status: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Only an admin can update a lead.");
  }
  if (!STATUSES.includes(status as LeadStatus)) {
    throw new Error("Invalid status.");
  }
  await updateLeadStatus(id, status as LeadStatus);
  revalidatePath("/leads");
}
