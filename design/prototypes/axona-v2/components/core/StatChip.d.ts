import { CSSProperties, HTMLAttributes } from "react";

export interface StatChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Mono uppercase label rendered before the value. Optional. */
  label?: string;
  /** The value shown in the grey mono chip. */
  value: string | number;
  style?: CSSProperties;
}

export function StatChip(props: StatChipProps): JSX.Element;
