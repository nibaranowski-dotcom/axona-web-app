import { redirect } from "next/navigation";

// UX.3 — the app lands on the Command Center. "/" redirects to /core; Mission
// Control (the dark launcher) moved to /launcher (reachable from the sidebar
// wordmark + search). Pure routing — no data fetch here.
export default function RootPage() {
  redirect("/core");
}
