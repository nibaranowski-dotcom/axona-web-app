"use client";

import dynamic from "next/dynamic";

// LOGIN.1 — client-only mount for the ⌘K palette (SRCH.3). The palette is a
// client overlay that only ever appears after a keypress, so it has no reason to
// server-render — and server-rendering it is exactly what broke: in Next 14 dev,
// when the synthetic /_not-found compiled before a route sharing the root layout,
// CommandPalette was invoked server-side and threw `useRef of null`, 500-ing the
// route. `ssr: false` means CommandPalette never runs on the server on ANY route
// (shell, launcher, or a stray prefetch/not-found prerender), so that whole class
// of crash cannot happen. The wrapper is a client component, so ssr:false is legal
// here (it is not, directly inside a Server Component).
const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteMount() {
  return <CommandPalette />;
}
