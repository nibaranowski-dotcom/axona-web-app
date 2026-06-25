import type { ReactNode } from "react";
import "@axona/config/styles/tokens.css";
import "./globals.css";
import { archivo, jetbrainsMono } from "./fonts";

export const metadata = {
  title: "Axona",
  description: "The AI-native operating system for robotics companies.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
