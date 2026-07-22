"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import type { ImportResult } from "@axona/db";
import { importUnitsAction } from "@/app/(shell)/units/actions";

// PLM.2 — CSV import, import-first. Time-to-value is the requirement: the
// registry has to be usable from a spreadsheet on day one. The flow is always
// DRY RUN FIRST — you see exactly what would be created/updated and every
// malformed row, with its row number, BEFORE anything is written. Applying is a
// second, explicit act (propose → approve, the product's shape everywhere).

export function ImportUnitsPanel({
  exampleModel,
}: {
  /** A model code from THIS org's catalogue — never a hardcoded demo model. */
  exampleModel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsv("");
    setFileName(null);
    setPreview(null);
    setApplied(null);
    setFailure(null);
  };

  const run = (dryRun: boolean) => {
    setFailure(null);
    startTransition(async () => {
      try {
        const res = await importUnitsAction(csv, dryRun);
        if (dryRun) setPreview(res);
        else {
          setApplied(res);
          router.refresh();
        }
      } catch (e) {
        setFailure(
          e instanceof Error ? e.message : "The import could not be run.",
        );
      }
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setPreview(null);
    setApplied(null);
    setCsv(await f.text());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-transparent px-[14px] py-[9px] text-[13px] font-semibold text-ink transition-colors hover:border-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        Import units (CSV)
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-units-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/30 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[86vh] w-full max-w-[620px] overflow-y-auto rounded-card border border-line bg-paper p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                  Unit registry
                </div>
                <h2
                  id="import-units-title"
                  className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-ink"
                >
                  Import units from CSV
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                aria-label="Close import"
                className="rounded-btn border border-line-strong px-2.5 py-1 text-[12px] text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-[12.5px] leading-[1.55] text-ink-muted">
              Required columns:{" "}
              <span className="font-mono text-[11.5px] text-ink">
                serial, model, status
              </span>
              . Optional:{" "}
              <span className="font-mono text-[11.5px] text-ink">
                builddate, sitelabel, customerlabel
              </span>
              . Re-importing the same file changes nothing — units are matched
              by serial.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files?.[0])}
                className="sr-only"
                id="import-units-file"
              />
              <label
                htmlFor="import-units-file"
                className="cursor-pointer rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong"
              >
                Choose file
              </label>
              <span className="font-mono text-[11px] text-ink-muted">
                {fileName ?? "no file selected"}
              </span>
            </div>

            <label htmlFor="import-units-csv" className="sr-only">
              CSV contents
            </label>
            <textarea
              id="import-units-csv"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
                setApplied(null);
              }}
              rows={6}
              spellCheck={false}
              placeholder={`serial,model,status\nSN-0001,${
                exampleModel ?? "your-model-code"
              },in_build`}
              className="mt-3 w-full rounded-[9px] border border-line-strong bg-panel p-3 font-mono text-[11.5px] text-ink outline-none focus:border-ink-strong"
            />

            {failure && (
              <p
                role="alert"
                className="mt-3 rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[12.5px] text-ink"
              >
                {failure}
              </p>
            )}

            {preview && !applied && <ResultBlock result={preview} kind="dry" />}
            {applied && <ResultBlock result={applied} kind="applied" />}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={!csv.trim() || pending}
                onClick={() => run(true)}
                className="rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {pending ? "Checking…" : "Dry run"}
              </button>
              <button
                type="button"
                disabled={!preview || !!applied || pending}
                onClick={() => run(false)}
                title={
                  preview
                    ? undefined
                    : "Run a dry run first to see what changes"
                }
                className="rounded-btn border border-ink-strong bg-ink-strong px-4 py-2 text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Import {preview ? `${preview.created + preview.updated}` : ""}{" "}
                units
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultBlock({
  result,
  kind,
}: {
  result: ImportResult;
  kind: "dry" | "applied";
}) {
  return (
    <div className="mt-4 rounded-[9px] border border-line bg-panel p-3.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
        {kind === "dry" ? "Dry run · nothing written" : "Imported"}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        <Stat v={result.created} l={kind === "dry" ? "to create" : "created"} />
        <Stat v={result.updated} l={kind === "dry" ? "to update" : "updated"} />
        <Stat v={result.errors.length} l="rows rejected" />
        <span className="font-mono text-[10.5px] text-ink-muted">
          {result.totalRows} rows read
        </span>
      </div>
      {result.errors.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            Rejected rows — these were not written
          </div>
          <ul className="mt-1.5 space-y-1">
            {result.errors.slice(0, 12).map((e) => (
              <li
                key={`${e.row}-${e.message}`}
                className="font-mono text-[11px] text-ink"
              >
                <span className="text-ink-muted">
                  row {e.row === 0 ? "header" : e.row}
                </span>{" "}
                · {e.message}
              </li>
            ))}
            {result.errors.length > 12 && (
              <li className="font-mono text-[11px] text-ink-muted">
                +{result.errors.length - 12} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ v, l }: { v: number; l: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[15px] font-bold text-ink">{v}</span>
      <span className="text-[11.5px] text-ink-muted">{l}</span>
    </span>
  );
}
