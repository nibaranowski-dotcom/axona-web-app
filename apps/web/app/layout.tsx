import type { ReactNode } from "react";

export const metadata = {
  title: "Axona",
  description: "The AI-native operating system for robotics companies.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
