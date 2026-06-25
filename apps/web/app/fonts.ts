import { Archivo, JetBrains_Mono } from "next/font/google";

// Self-hosted at build time by next/font (no runtime requests to Google).
// Exposed as CSS variables that styles/tokens.css maps to --font-sans / --font-mono.

export const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});
