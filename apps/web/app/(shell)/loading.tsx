import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

// UX.8 — route/shell transitions show the branded shell skeleton (matches the real
// 240/60/360 layout, so streamed content swaps in with no layout shift), replacing
// the old plain grey-bar placeholder.
export default function Loading() {
  return <ScreenSkeleton />;
}
