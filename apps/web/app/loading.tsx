import { FullScreenLoader } from "@/components/shell/FullScreenLoader";

// UX.8 — root cold-boot loader (pre-shell). Shown while the initial app/route
// resolves, before the shell layout mounts. Branded FullScreenLoader (1:1 to
// Loading.dc.html). Shell route transitions use the ScreenSkeleton instead.
export default function Loading() {
  return <FullScreenLoader />;
}
