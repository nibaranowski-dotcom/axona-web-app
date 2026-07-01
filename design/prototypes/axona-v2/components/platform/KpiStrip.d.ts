import { CSSProperties, HTMLAttributes } from "react";

export interface Kpi {
  /** The big number, e.g. "98.6%" or "$65.8M". */
  value: string;
  /** Mono uppercase caption beneath it. */
  label: string;
}

/**
 * Horizontal KPI summary strip for platform module headers.
 *
 * @startingPoint section="Platform" subtitle="Module KPI summary strip" viewport="720x90"
 */
export interface KpiStripProps extends HTMLAttributes<HTMLDivElement> {
  /** Cells, left to right. 3–5 reads best. */
  stats: Kpi[];
  style?: CSSProperties;
}

export function KpiStrip(props: KpiStripProps): JSX.Element;
