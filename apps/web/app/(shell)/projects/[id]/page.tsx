import { notFound } from "next/navigation";
import { dbForOrg } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getProjectMatrix } from "@/lib/matrix";
import {
  MatrixView,
  type MatrixScreenData,
} from "@/components/matrix/MatrixView";

// /projects/:id (build-spec §4.8) — a project opens into its Files matrix (rows ×
// AI-extracted columns). Data from MTX.1 getProjectMatrix (org-scoped). Core route
// → the global Axona pane (GA.1, citation-aware) stays.
export const dynamic = "force-dynamic";

const MODULE_LABEL: Record<string, string> = {
  procurement: "Procurement",
  manufacturing: "Manufacturing",
  quality: "Quality",
  sales: "Sales & CRM",
  fulfillment: "Fulfillment",
  fleet: "Fleet",
  "field-service": "Field Service",
  engineering: "Engineering",
  autonomy: "Autonomy",
  finance: "Finance",
  security: "Security",
  legal: "Legal",
};

export default async function ProjectMatrixPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return notFound();
  const db = dbForOrg(user.orgId);
  const project = await db.project.findFirst({
    where: { id: params.id },
    select: { id: true, name: true, moduleKey: true },
  });
  if (!project) return notFound();

  const matrix = await getProjectMatrix(user.orgId, project.id);
  const data: MatrixScreenData = {
    projectId: project.id,
    projectName: project.name,
    moduleLabel: MODULE_LABEL[project.moduleKey] ?? project.moduleKey,
    ...matrix,
  };
  return <MatrixView data={data} />;
}
