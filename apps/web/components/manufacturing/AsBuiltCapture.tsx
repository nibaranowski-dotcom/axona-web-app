"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import type { AsBuiltCapture as CaptureData } from "@/lib/manufacturing";
import { captureComponentAction } from "@/app/(shell)/manufacturing/actions";

// PLM.V3 — the as-built capture card (Manufacturing.dc.html). Components are
// scanned against the BOM at build; lots + revisions auto-diff and substitutions
// are flagged AS THEY HAPPEN. Substitutions render in INK, never an error color
// (the PLM.4 invariant — a swap is the normal case, not a fault). "Full diff →" opens the
// unit's as-built diff (PLM.4); the write path is the RBAC-gated capture action.

function agoLabel(at: Date | null): string {
  if (!at) return "—";
  const s = Math.max(
    0,
    Math.floor((Date.now() - new Date(at).getTime()) / 1000),
  );
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AsBuiltCapture({
  capture,
  canCapture,
}: {
  capture: CaptureData;
  canCapture: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(
    capture.openPositions[0]?.position ?? "",
  );
  const [lot, setLot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = capture.openPositions.find((p) => p.position === position);

  const submit = () => {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await captureComponentAction({
          serial: capture.serial,
          bomPosition: selected.position,
          partRevisionId: selected.partRevisionId,
          lotCode: lot.trim() || null,
        });
        setLot("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Capture failed.");
      }
    });
  };

  return (
    <section
      aria-label={`As-built capture for ${capture.serial}`}
      className="rounded-card border border-line bg-paper px-5 py-[18px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink">
            As-built capture · {capture.serial}
          </h2>
          <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
            vs BOM rev {capture.bomRevision}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {canCapture && (
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v);
                setError(null);
              }}
              aria-expanded={open}
              disabled={capture.openPositions.length === 0}
              className="inline-flex items-center gap-[7px] rounded-btn border border-line-strong bg-paper px-[13px] py-[7px] text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ScanLine
                className="h-[13px] w-[13px]"
                strokeWidth={1.9}
                aria-hidden
              />
              Scan component
            </button>
          )}
          <Link
            href={capture.asBuiltHref}
            className="text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Full diff →
          </Link>
        </div>
      </div>

      <p className="mt-1.5 text-[12px] text-ink-muted">
        Components are scanned against the BOM at build — lots and revisions
        auto-diff, substitutions are flagged as they happen.
      </p>

      <div className="mt-3.5 flex flex-wrap gap-5">
        <Stat v={`${capture.scanned}/${capture.total}`} l="Scanned" />
        <Stat v={capture.substitutions} l="Substitutions" divider ink />
        <Stat v={agoLabel(capture.lastCapturedAt)} l="Last capture" divider />
      </div>

      {open && canCapture && (
        <div className="mt-3.5 flex flex-wrap items-end gap-3 rounded-[10px] border border-line bg-panel px-3.5 py-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
              Position
            </span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {capture.openPositions.map((p) => (
                <option key={p.position} value={p.position}>
                  {p.position} · {p.partNumber} {p.rev}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
              Lot (optional)
            </span>
            <input
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              placeholder="e.g. 88421"
              className="w-[130px] rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !selected}
            className="rounded-btn bg-ink-strong px-4 py-2 text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {pending ? "Capturing…" : "Capture"}
          </button>
          {error && (
            <span role="alert" className="text-[12px] text-ink">
              {error}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        {capture.components.slice(0, 6).map((c) => (
          <div
            key={c.position}
            className="grid grid-cols-[1.4fr_1.1fr_1fr] items-center gap-3 border-t border-line py-2.5"
          >
            <div className="min-w-0">
              <span className="font-mono text-[12px] font-semibold text-ink">
                {c.partNumber} {c.rev}
              </span>
              <span className="ml-2 font-mono text-[10px] text-ink-faint">
                pos {c.position}
              </span>
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {c.lotCode ? `lot ${c.lotCode}` : "no lot"}
            </span>
            <span className="justify-self-end">
              <span
                className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold ${
                  c.isSubstitution
                    ? "bg-ink-strong text-on-dark"
                    : "border border-line-panel bg-panel text-ink-muted"
                }`}
              >
                {c.isSubstitution ? "Substitution" : "Match"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({
  v,
  l,
  divider = false,
  ink = false,
}: {
  v: string | number;
  l: string;
  divider?: boolean;
  ink?: boolean;
}) {
  return (
    <div className={divider ? "border-l border-line pl-5" : ""}>
      <div
        className={`font-mono text-[20px] font-bold tracking-[-0.02em] ${ink ? "text-ink-strong" : "text-ink"}`}
      >
        {v}
      </div>
      <div className="mt-[3px] font-mono text-[9px] uppercase tracking-[0.05em] text-ink-faint">
        {l}
      </div>
    </div>
  );
}
