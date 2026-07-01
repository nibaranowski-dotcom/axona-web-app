import { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";

/**
 * Axona action button.
 *
 * @startingPoint section="Core" subtitle="Primary / dark / ghost action button" viewport="320x80"
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Lime primary by default. */
  variant?: "primary" | "dark" | "ghost";
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
  style?: CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;
