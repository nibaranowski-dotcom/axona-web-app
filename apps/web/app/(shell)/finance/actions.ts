"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { decide } from "@/lib/approvals";

// Finance credit note (FIN.2), RBAC.5. Issuing a credit note against an open
// receivable is a gated human decision — it runs through the shared approval
// primitive (decide → requireRole FINANCE/ADMIN → org-scoped → AUDIT.1), so the
// issuance is audited and surfaces on /audit with the approver. The registry's
// creditnote.issue targets the Invoice (status → "credited").

export async function issueCreditNote(invoiceId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("creditnote.issue", invoiceId, "APPROVE", user); // role-gates + audits
  revalidatePath("/finance");
}

export async function rejectCreditNote(invoiceId: string): Promise<void> {
  const user = await getCurrentUser();
  await decide("creditnote.issue", invoiceId, "REJECT", user);
  revalidatePath("/finance");
}
