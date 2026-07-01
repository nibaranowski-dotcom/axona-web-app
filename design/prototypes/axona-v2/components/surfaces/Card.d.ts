import { ReactNode, CSSProperties, HTMLAttributes } from "react";

/**
 * Warm-grey feature card with optional skeleton mock-UI footer.
 *
 * @startingPoint section="Surfaces" subtitle="Feature card with mock-UI footer" viewport="380x340"
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  body?: string;
  /** Mono caption shown in the default skeleton footer. */
  caption?: string;
  /** Custom footer content; overrides the default skeleton. */
  children?: ReactNode;
  style?: CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
