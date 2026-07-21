import Link from "next/link";

// LOGIN.1 — a real, branded root not-found boundary. Two jobs:
// 1. UX — unknown paths and every notFound() call (the (shell)/[module] catch-all,
//    /projects/[id], /workflows/[id]) get a designed 404 instead of Next's bare
//    default page.
// 2. Robustness — giving the root a concrete not-found boundary means Next no
//    longer leans on the synthetic /_not-found default, whose dev compile order
//    was what mis-wired the root layout's client components and 500-ed /login.
//    This renders inside the root layout, which (post-LOGIN.1) no longer mounts
//    the ⌘K palette, so it carries no client-only surfaces.
export default function NotFound() {
  return (
    <main
      id="main"
      aria-label="Page not found"
      className="grid min-h-dvh place-items-center bg-panel font-sans text-ink"
    >
      <div className="max-w-[440px] px-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-strong">
          This page could not be found
        </h1>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-ink-muted">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center rounded-btn border border-line-strong bg-paper px-4 py-2 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Back to Axona
        </Link>
      </div>
    </main>
  );
}
