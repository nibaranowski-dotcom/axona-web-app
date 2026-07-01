import { ReactNode, CSSProperties, HTMLAttributes } from "react";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Solid near-black when true, outlined when false. */
  active?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Chip(props: ChipProps): JSX.Element;
