import { ReactNode, CSSProperties, HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "accent" | "success" | "neutral";
  children?: ReactNode;
  style?: CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
