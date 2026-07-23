"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROOT_CAUSES } from "@/lib/quality";
import { setNcrRootCauseAction } from "@/app/(shell)/quality/actions";

// PLM.V2 — the RCA root-cause classification cell. The mutation lives in the
// server action (RBAC-gated + audited); this cell only calls it, so the Quality
// screen stays read-only in its components. Authorized users get a select; others
// see the classification read-only. Labels are the RootCause taxonomy.

const LABEL: Record<string, string> = {
  software: "Software",
  hardware: "Hardware",
  design: "Design",
  production: "Production",
  component: "Component",
  field_modification: "Field mod",
};

export function RootCauseCell({
  code,
  rootCause,
  canClassify,
}: {
  code: string;
  rootCause: string | null;
  canClassify: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(rootCause ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canClassify) {
    return value ? (
      <span className="inline-flex items-center rounded-pill border border-line-panel bg-panel px-2.5 py-[3px] text-[10.5px] font-semibold text-ink">
        {LABEL[value] ?? value}
      </span>
    ) : (
      <span className="text-[12px] text-ink-faint">unclassified</span>
    );
  }

  const onChange = (next: string) => {
    if (!next || next === value) return;
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setNcrRootCauseAction(code, next);
        router.refresh();
      } catch (e) {
        setValue(prev);
        setError(e instanceof Error ? e.message : "Failed to classify.");
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`rc-${code}`}>
        Root cause for {code}
      </label>
      <select
        id={`rc-${code}`}
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-btn border border-line-strong bg-paper px-2 py-1 text-[11.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
      >
        <option value="">unclassified</option>
        {ROOT_CAUSES.map((c) => (
          <option key={c} value={c}>
            {LABEL[c] ?? c}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-[10px] text-ink">
          !
        </span>
      )}
    </span>
  );
}
