import type { ReactNode } from "react";
import "@axona/config/styles/tokens.css";
import "./globals.css";
import { archivo, jetbrainsMono } from "./fonts";
import { CommandPalette } from "@/components/search/CommandPalette";

export const metadata = {
  title: "Axona",
  description: "The AI-native operating system for robotics companies.",
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
        {/* Global ⌘K command palette (SRCH.3) — works on / and inside the shell */}
        <CommandPalette />
      </body>
    </html>
  );
}
