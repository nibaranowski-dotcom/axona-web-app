import { redirect } from "next/navigation";

// /onboarding (AUTH.4 seam) — the post-signup landing. The onboarding wizard
// (profile → invite team → enable modules) is AUTH.6; until then this is a thin
// redirect to the Command Center so a fresh signup reaches /core logged-in.
// /// AUTH.6: replace this redirect with the onboarding flow.
export default function OnboardingPage() {
  redirect("/core");
}
