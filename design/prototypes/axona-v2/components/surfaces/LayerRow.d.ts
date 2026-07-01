import { CSSProperties, HTMLAttributes } from "react";

export interface LayerRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Mono left-hand tag, e.g. "L2 · INTELLIGENCE & AGENT SPINE". */
  tag: string;
  title: string;
  body: string;
  style?: CSSProperties;
}

export function LayerRow(props: LayerRowProps): JSX.Element;
