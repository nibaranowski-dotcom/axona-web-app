import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

// UX.8 — route transitions show the branded skeleton, replacing the old plain
// grey-bar placeholder. variant="main": on a client-side transition the shell
// layout (sidebar + agent pane) PERSISTS and this fallback fills only the <main>
// slot, so we skeletonize just the main column (topbar + stats + hero + table) —
// aligned to the real main so content swaps in with no layout shift, and without
// doubling the persisted sidebar/pane.
export default function Loading() {
  return <ScreenSkeleton variant="main" />;
}
