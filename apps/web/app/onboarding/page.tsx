import { redirect } from "next/navigation";
import { prisma } from "@axona/db";
import { getCurrentUser } from "@/lib/session";
import { getOrgOnboarding } from "@/lib/onboarding";
import { OnboardingWizard } from "@/components/auth/OnboardingWizard";

// /onboarding (AUTH.6) — the 3-step wizard. Full-screen, outside the app shell.
// Guards: only a not-yet-onboarded org's ADMIN runs it — an onboarded org, or a
// non-ADMIN, is sent to /core (never 500). AUTH.3 routing sends fresh ADMINs here.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fonboarding");

  const onboarding = await getOrgOnboarding(user.orgId);
  // Already onboarded, or not an ADMIN → straight to the Command Center.
  if (onboarding?.onboardedAt || user.role !== "ADMIN") redirect("/core");

  const org = await prisma.org.findUnique({
    where: { id: user.orgId },
    select: { name: true, industry: true },
  });

  return (
    <OnboardingWizard
      orgName={org?.name ?? ""}
      orgIndustry={org?.industry ?? null}
    />
  );
}
