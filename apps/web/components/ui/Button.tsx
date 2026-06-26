import type { ButtonHTMLAttributes, ReactNode } from "react";

// DS.1 Button (from design system components/core/Button.jsx). Lime primary;
// dark + ghost for secondary. Pill-ish radius, weight 600, no shadow.

type Variant = "primary" | "dark" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-btn font-sans font-semibold leading-none transition-colors duration-200 ease-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-paper";

const sizeClass: Record<Size, string> = {
  sm: "px-4 py-2 text-[13.5px]",
  md: "px-5 py-[11px] text-[14.5px]",
  lg: "px-[26px] py-[14px] text-[15.5px]",
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink border border-accent hover:bg-accent-hover hover:border-accent-hover focus-visible:ring-ink-strong",
  dark: "bg-ink-strong text-on-dark border border-ink-strong focus-visible:ring-accent",
  ghost:
    "bg-transparent text-ink border border-line-strong hover:border-ink-strong focus-visible:ring-ink-strong",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${base} ${sizeClass[size]} ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
