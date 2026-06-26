import type { ButtonHTMLAttributes, ReactNode } from "react";

// DS.1 Pill / Chip (components/core/Chip.jsx). Selectable tab/filter pill.
// Active = solid near-black; inactive = outlined on paper.

export function Pill({
  active = false,
  className = "",
  children,
  ...rest
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const state = active
    ? "bg-ink-strong text-on-dark border-ink-strong"
    : "bg-paper text-ink-muted border-line-strong hover:border-ink-strong";
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center rounded-pill border px-[15px] py-2 font-sans text-[13.5px] font-medium transition-colors duration-200 ease-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${state} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
