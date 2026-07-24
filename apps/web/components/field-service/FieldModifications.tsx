"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { FieldModRow, RecordFormData } from "@/lib/field-service";
import {
  recordFieldModificationAction,
  type RecordFieldModInput,
} from "@/app/(shell)/field-service/actions";
import type { FieldModChange } from "@axona/db";

// PLM.V5 — the Field modifications region (Field Service.dc.html, between the
// dispatch board and the work-order queue). A swap/mod at a deployed unit drifts
// its configuration — recording it keeps the golden thread intact. Recording lands
// PENDING; an approved change (decide("field.mod")) moves the unit's resolved
// config forward. Rows link to the Unit page (PLM.3). State pills use ink/accent/
// success only — no invented critical colors (a rejected mod reads muted).

type StatePill = { bg: string; fg: string };
function statePill(state: string): StatePill {
  if (state === "approved")
    return { bg: "bg-success-tint", fg: "text-success" };
  if (state === "pending") return { bg: "bg-accent", fg: "text-accent-ink" };
  return { bg: "bg-panel", fg: "text-ink-muted" }; // rejected / other
}
function stateLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

type ChangeType = "hw" | "sw" | "calibration";

export function FieldModifications({
  rows,
  recordForm,
  canRecord,
}: {
  rows: FieldModRow[];
  recordForm: RecordFormData;
  canRecord: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const units = recordForm.units;
  const [serial, setSerial] = useState(units[0]?.serial ?? "");
  const [type, setType] = useState<ChangeType>("hw");
  const [summary, setSummary] = useState("");
  const [positionKey, setPositionKey] = useState("");
  const [toRevId, setToRevId] = useState("");
  const [lot, setLot] = useState("");
  const [releaseId, setReleaseId] = useState(
    recordForm.softwareReleases[0]?.id ?? "",
  );
  const [detail, setDetail] = useState("");

  const unit = useMemo(
    () => units.find((u) => u.serial === serial),
    [units, serial],
  );
  const position = useMemo(
    () => unit?.positions.find((p) => p.bomPosition === positionKey),
    [unit, positionKey],
  );

  const reset = () => {
    setSummary("");
    setPositionKey("");
    setToRevId("");
    setLot("");
    setDetail("");
    setError(null);
  };

  const buildChange = (): FieldModChange | null => {
    if (type === "sw") {
      const rel = recordForm.softwareReleases.find((r) => r.id === releaseId);
      if (!rel) return null;
      return {
        type: "sw",
        softwareReleaseId: rel.id,
        component: rel.component,
        toVersion: rel.version,
      };
    }
    if (type === "hw") {
      if (!position) return null;
      const rev = position.revisions.find((r) => r.id === toRevId);
      if (!rev) return null;
      return {
        type: "hw",
        bomPosition: position.bomPosition,
        partRevisionId: rev.id,
        partNumber: position.partNumber,
        toRev: rev.rev,
        lotCode: lot.trim() || null,
      };
    }
    return { type: "calibration", detail: detail.trim() || "calibration" };
  };

  const submit = () => {
    const change = buildChange();
    if (!serial) {
      setError("Pick a unit.");
      return;
    }
    if (!change) {
      setError("Pick the change target.");
      return;
    }
    if (!summary.trim()) {
      setError("Describe the field change.");
      return;
    }
    setError(null);
    const payload: RecordFieldModInput = {
      serial,
      summary: summary.trim(),
      change,
    };
    startTransition(async () => {
      try {
        await recordFieldModificationAction(payload);
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not record.");
      }
    });
  };

  return (
    <section
      aria-label="Field modifications"
      className="overflow-hidden rounded-card border border-line bg-paper"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-[15px]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-ink">
            Field modifications
          </h2>
          <span className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
            updates unit config
          </span>
        </div>
        {canRecord && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
            }}
            aria-expanded={open}
            disabled={units.length === 0}
            className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-[13px] py-[7px] text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden />
            Record field change
          </button>
        )}
      </div>

      <p className="px-5 pb-3 text-[12px] text-ink-muted">
        A swap or mod at a deployed unit drifts its configuration — record it so
        the golden thread stays intact. Approved changes update the unit&rsquo;s
        resolved config.
      </p>

      {open && canRecord && (
        <div className="mx-5 mb-3 rounded-[10px] border border-line bg-panel px-3.5 py-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Unit">
              <select
                value={serial}
                onChange={(e) => {
                  setSerial(e.target.value);
                  setPositionKey("");
                  setToRevId("");
                }}
                className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {units.map((u) => (
                  <option key={u.serial} value={u.serial}>
                    {u.serial} · {u.site}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Change type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ChangeType)}
                className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="hw">Part swap</option>
                <option value="sw">Software update</option>
                <option value="calibration">Calibration</option>
              </select>
            </Field>

            {type === "hw" && (
              <>
                <Field label="Position">
                  <select
                    value={positionKey}
                    onChange={(e) => {
                      setPositionKey(e.target.value);
                      setToRevId("");
                    }}
                    className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="">Select…</option>
                    {(unit?.positions ?? []).map((p) => (
                      <option key={p.bomPosition} value={p.bomPosition}>
                        {p.bomPosition} · {p.partNumber} {p.currentRev}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="New revision">
                  <select
                    value={toRevId}
                    onChange={(e) => setToRevId(e.target.value)}
                    disabled={!position}
                    className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="">Select…</option>
                    {(position?.revisions ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.rev}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lot (optional)">
                  <input
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    placeholder="e.g. 9920"
                    className="w-[110px] rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </Field>
              </>
            )}

            {type === "sw" && (
              <Field label="Software release">
                <select
                  value={releaseId}
                  onChange={(e) => setReleaseId(e.target.value)}
                  className="rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {recordForm.softwareReleases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.component} {r.version}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {type === "calibration" && (
              <Field label="Detail">
                <input
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="e.g. re-shim"
                  className="w-[150px] rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </Field>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="What changed" grow>
              <input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Battery pack swap"
                className="w-full min-w-[220px] rounded-btn border border-line-strong bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </Field>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-btn bg-ink-strong px-4 py-2 text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {pending ? "Recording…" : "Record (pending approval)"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[12px] text-ink">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_1.1fr_1.7fr_1fr_1fr] gap-3 border-t border-line px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-faint">
        <span>Unit · Site</span>
        <span>Change</span>
        <span>Config effect</span>
        <span>Tech · when</span>
        <span>Approval</span>
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-[12.5px] text-ink-muted">
          No field modifications recorded yet.
        </p>
      ) : (
        rows.map((f) => {
          const pill = statePill(f.state);
          return (
            <Link
              key={f.id}
              href={f.unitHref}
              className="grid grid-cols-[1fr_1.1fr_1.7fr_1fr_1fr] items-center gap-3 border-t border-line px-5 py-3 transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-semibold text-ink">
                  {f.serial}
                </div>
                <div className="mt-px text-[10.5px] text-ink-faint">
                  {f.site}
                </div>
              </div>
              <span className="text-[12.5px] text-ink">{f.change}</span>
              <span className="truncate font-mono text-[10.5px] text-ink-muted">
                {f.effect}
              </span>
              <span className="font-mono text-[10.5px] text-ink-muted">
                {f.techWhen}
              </span>
              <span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-[9px] py-[3px] text-[10.5px] font-semibold ${pill.bg} ${pill.fg}`}
                >
                  {stateLabel(f.state)}
                </span>
              </span>
            </Link>
          );
        })
      )}
    </section>
  );
}

function Field({
  label,
  children,
  grow = false,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${grow ? "flex-1" : ""}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
