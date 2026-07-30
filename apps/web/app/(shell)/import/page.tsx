import { importEntityInfo, dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/rbac";
import { ImportPanel } from "@/components/io/ImportPanel";

// IO.1 — the one shared import surface, reused across every registered entity
// (Units · Parts today). Upload → optional AI-verify (propose mapping + flag
// rows) → dry-run preview → confirm. The write + audit live in ./actions.ts.

export const metadata = { title: "Import · Axona" };

export default async function ImportPage() {
  const user = await getCurrentUser();
  const canImport = hasRole(user, ["ENGINEER", "ADMIN"]);
  const entities = importEntityInfo();

  // an example model code from THIS org's catalogue (never a hardcoded demo code).
  let exampleModel: string | undefined;
  if (user) {
    const db = dbForOrg(user.orgId);
    const m = await db.productModel.findFirst({ select: { code: true } });
    exampleModel = m?.code ?? undefined;
  }

  return (
    <ImportPanel
      entities={entities}
      canImport={canImport}
      exampleModel={exampleModel}
    />
  );
}
