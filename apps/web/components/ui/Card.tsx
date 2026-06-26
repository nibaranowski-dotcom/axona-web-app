import type { HTMLAttributes, ReactNode } from "react";

// DS.1 Card (components/surfaces/Card.jsx). Warm-grey product panel: optional
// title + body, then children. Hairline, no shadow (product surface).

export function Card({
  title,
  body,
  className = "",
  children,
  ...rest
}: {
  title?: ReactNode;
  body?: ReactNode;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-line-panel bg-panel p-6 ${className}`}
      {...rest}
    >
      {title != null && (
        // styled as the DS card title; a div (not a heading) to avoid imposing a
        // document-outline level on arbitrary placements (heading-order a11y).
        <div className="font-sans text-xl font-semibold tracking-tight text-ink">
          {title}
        </div>
      )}
      {body != null && (
        <p className="mt-2 max-w-[42ch] font-sans text-[14.5px] leading-snug text-ink-muted">
          {body}
        </p>
      )}
      {children}
    </div>
  );
}
