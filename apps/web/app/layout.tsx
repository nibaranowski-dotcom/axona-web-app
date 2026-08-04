import type { ReactNode } from "react";
import "@axona/config/styles/tokens.css";
import "./globals.css";
import { archivo, jetbrainsMono } from "./fonts";

// DEMO-INTEGRITY (SEED.4): this <meta description> is one devtools glance (or link
// preview) away from a category word the engineering buyer reads as vaporware. Kept
// to what the product does. The marketing site keeps its own positioning copy.
export const metadata = {
  title: "Axona",
  description:
    "Axona — configuration management and traceability for how robotics companies build.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* A11Y.1 — skip-to-content bypass. First focusable in the body; sr-only
            until focused (no visible layout change). Targets the page's #main
            landmark (every route's primary <main> carries id="main"). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-btn focus:border focus:border-line-strong focus:bg-paper focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Skip to content
        </a>
        {children}
        {/* LOGIN.1 — the ⌘K palette (SRCH.3) is a SIGNED-IN surface; it is mounted
            by the (shell) layout and the launcher/search pages, NOT here at the
            root. Keeping it out of the root layout means public + auth routes
            (/login, /signup, /reset, …) and the not-found boundary never render
            this client component — which is both correct (they can't open it) and
            the fix for the recurring /login 500: in Next 14 dev, when the synthetic
            /_not-found compiled before /login (a fresh browser probes
            /.well-known/appspecific/com.chrome.devtools.json first), this component
            was invoked server-side and threw `useRef of null`, 500-ing every route
            that shares the root layout. */}
      </body>
    </html>
  );
}
