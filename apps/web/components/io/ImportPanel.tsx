"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import type { ImportResult, ImportEntityInfo } from "@axona/db";
import type { ImportMappingProposal } from "@axona/agents";
import {
  previewImportAction,
  proposeMappingAction,
  confirmImportAction,
} from "@/app/(shell)/import/actions";

// IO.1 — the one shared import surface. Same propose → approve → audit flow the
// unit registry (PLM.2) uses, generalized across the registered entities and with
// an optional MTX.1 AI-verify step for messy files. Always DRY RUN FIRST — you
// see exactly what would be created/updated and every rejected row before any
// write. AI-verify is an extra, optional step: the agent proposes a column
// mapping + flags rows; you review and approve it; still nothing writes until you
// confirm.

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function ImportPanel({
  entities,
  canImport,
  exampleModel,
}: {
  entities: ImportEntityInfo[];
  canImport: boolean;
  /** A model code from THIS org's catalogue — never a hardcoded demo model. */
  exampleModel?: string;
}) {
  const router = useRouter();
  const [entityKey, setEntityKey] = useState(entities[0]?.key ?? "unit");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ImportMappingProposal | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const entity = useMemo(
    () => entities.find((e) => e.key === entityKey) ?? entities[0],
    [entities, entityKey],
  );

  const resetResults = () => {
    setProposal(null);
    setMapping({});
    setPreview(null);
    setApplied(null);
    setFailure(null);
  };

  const switchEntity = (key: string) => {
    setEntityKey(key);
    resetResults();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    resetResults();
    setCsv(await f.text());
  };

  // AI-verify: the agent proposes a mapping + flags rows (writes nothing).
  const aiVerify = () => {
    setFailure(null);
    startTransition(async () => {
      try {
        const p = await proposeMappingAction(entityKey, csv);
        setProposal(p);
        setMapping({ ...p.mapping });
        setPreview(null);
        setApplied(null);
      } catch (e) {
        setFailure(msg(e));
      }
    });
  };

  const activeMapping = () =>
    proposal && Object.keys(mapping).length > 0 ? mapping : undefined;

  const dryRun = () => {
    setFailure(null);
    startTransition(async () => {
      try {
        const res = await previewImportAction(entityKey, csv, activeMapping());
        setPreview(res);
        setApplied(null);
      } catch (e) {
        setFailure(msg(e));
      }
    });
  };

  const confirm = () => {
    setFailure(null);
    startTransition(async () => {
      try {
        const res = await confirmImportAction(entityKey, csv, {
          mapping: activeMapping(),
          model: proposal?.model,
          confidence: proposal?.confidence,
        });
        setApplied(res);
        router.refresh();
      } catch (e) {
        setFailure(msg(e));
      }
    });
  };

  if (!entity) return null;

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-8">
      <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-muted">
        Data import
      </div>
      <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Import from spreadsheet
      </h1>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-ink-muted">
        Bring any registered entity in from a CSV — validated, idempotent, and
        atomic (only clean rows land; re-importing changes nothing). For a messy
        file with unfamiliar headers, run AI-verify: the agent proposes a column
        mapping and flags suspect rows for you to approve before anything
        writes.
      </p>

      {!canImport && (
        <p
          role="note"
          className="mt-5 rounded-[9px] border border-line-strong bg-panel px-3.5 py-2.5 text-[12.5px] text-ink"
        >
          You have read-only access. Importing requires the Engineer or Admin
          role.
        </p>
      )}

      {/* entity picker */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {entities.map((e) => {
          const on = e.key === entityKey;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => switchEntity(e.key)}
              aria-pressed={on}
              className={`rounded-btn border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                on
                  ? "border-ink-strong bg-ink-strong text-on-dark"
                  : "border-line-strong text-ink hover:border-ink-strong"
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[12.5px] leading-[1.55] text-ink-muted">
        Required columns:{" "}
        <span className="font-mono text-[11.5px] text-ink">
          {entity.required.join(", ")}
        </span>
        {entity.optional.length > 0 && (
          <>
            . Optional:{" "}
            <span className="font-mono text-[11.5px] text-ink">
              {entity.optional.join(", ")}
            </span>
          </>
        )}
        .
      </p>

      {/* file + paste */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="sr-only"
          id="import-file"
          disabled={!canImport}
        />
        <label
          htmlFor="import-file"
          className={`rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors ${
            canImport ? "cursor-pointer hover:border-ink-strong" : "opacity-40"
          }`}
        >
          Choose file
        </label>
        <span className="font-mono text-[11px] text-ink-muted">
          {fileName ?? "no file selected"}
        </span>
      </div>

      <label htmlFor="import-csv" className="sr-only">
        CSV contents
      </label>
      <textarea
        id="import-csv"
        value={csv}
        disabled={!canImport}
        onChange={(e) => {
          setCsv(e.target.value);
          resetResults();
        }}
        rows={7}
        spellCheck={false}
        placeholder={placeholderFor(entity, exampleModel)}
        className="mt-3 w-full rounded-[9px] border border-line-strong bg-panel p-3 font-mono text-[11.5px] text-ink outline-none focus:border-ink-strong disabled:opacity-50"
      />

      {failure && (
        <p
          role="alert"
          className="mt-3 rounded-[9px] border border-line-strong bg-panel px-3 py-2.5 text-[12.5px] text-ink"
        >
          {failure}
        </p>
      )}

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={!canImport || !csv.trim() || pending}
          onClick={aiVerify}
          className="rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Upload
            className="mr-1.5 inline h-3.5 w-3.5"
            strokeWidth={1.8}
            aria-hidden
          />
          {pending ? "Working…" : "AI-verify (messy file)"}
        </button>
        <button
          type="button"
          disabled={!canImport || !csv.trim() || pending}
          onClick={dryRun}
          className="rounded-btn border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-strong disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {pending ? "Checking…" : "Dry run"}
        </button>
        <button
          type="button"
          disabled={!canImport || !preview || !!applied || pending}
          onClick={confirm}
          title={
            preview ? undefined : "Run a dry run first to see what changes"
          }
          className="rounded-btn border border-ink-strong bg-ink-strong px-4 py-2 text-[12.5px] font-semibold text-on-dark transition-colors hover:bg-black disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Confirm import {preview ? `${preview.created + preview.updated}` : ""}
        </button>
      </div>

      {proposal && !applied && (
        <MappingProposalBlock
          proposal={proposal}
          mapping={mapping}
          onChange={(field, header) => {
            setMapping((m) => {
              const next = { ...m };
              if (header) next[field] = header;
              else delete next[field];
              return next;
            });
            setPreview(null);
          }}
        />
      )}

      {preview && !applied && <ResultBlock result={preview} kind="dry" />}
      {applied && <ResultBlock result={applied} kind="applied" />}
    </div>
  );
}

function MappingProposalBlock({
  proposal,
  mapping,
  onChange,
}: {
  proposal: ImportMappingProposal;
  mapping: Record<string, string>;
  onChange: (field: string, header: string) => void;
}) {
  const low = proposal.confidence < 0.5;
  return (
    <div className="mt-5 rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.07em] text-ink-muted">
          AI-proposed mapping · review + approve
        </div>
        <div className="font-mono text-[11px] text-ink-muted">
          overall confidence{" "}
          <span className={low ? "font-bold text-ink" : "font-bold text-ink"}>
            {pct(proposal.confidence)}
          </span>{" "}
          · model {proposal.model}
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-[1.5] text-ink-muted">
        Each field below is mapped to a column the agent identified, with its
        confidence. Adjust any mapping, then run a dry run — nothing is written
        until you confirm.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Field</Th>
              <Th>Mapped column</Th>
              <Th>Confidence</Th>
            </tr>
          </thead>
          <tbody>
            {proposal.fields.map((f) => {
              const flagged = f.confidence < 0.5;
              return (
                <tr key={f.field} className="border-b border-line">
                  <td className="py-2 pr-3 align-top">
                    <span className="font-mono text-[11.5px] text-ink">
                      {f.field}
                    </span>
                    {f.required && (
                      <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
                        req
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <label className="sr-only" htmlFor={`map-${f.field}`}>
                      Column for {f.field}
                    </label>
                    <select
                      id={`map-${f.field}`}
                      value={mapping[f.field] ?? ""}
                      onChange={(e) => onChange(f.field, e.target.value)}
                      className="min-w-0 max-w-[220px] rounded-[7px] border border-line-strong bg-paper px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-ink-strong"
                    >
                      <option value="">— unmapped —</option>
                      {proposal.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 align-top">
                    <span
                      className={`font-mono text-[11.5px] ${
                        flagged ? "font-bold text-ink" : "text-ink-muted"
                      }`}
                    >
                      {pct(f.confidence)}
                      {flagged && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-[0.05em]">
                          review
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {proposal.flaggedRows.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            {proposal.flaggedRows.length} rows flagged for review
          </div>
          <ul className="mt-1.5 space-y-1">
            {proposal.flaggedRows.slice(0, 10).map((r) => (
              <li key={r.row} className="font-mono text-[11px] text-ink">
                <span className="text-ink-muted">row {r.row}</span> ·{" "}
                {r.message}{" "}
                <span className="text-ink-muted">({pct(r.confidence)})</span>
              </li>
            ))}
            {proposal.flaggedRows.length > 10 && (
              <li className="font-mono text-[11px] text-ink-muted">
                +{proposal.flaggedRows.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="py-1.5 pr-3 font-mono text-[9px] font-medium uppercase tracking-[0.06em] text-ink-muted">
      {children}
    </th>
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

function placeholderFor(
  entity: ImportEntityInfo,
  exampleModel?: string,
): string {
  const header = [...entity.required, ...entity.optional].join(",");
  if (entity.key === "unit")
    return `${header}\nSN-0001,${exampleModel ?? "your-model-code"},in_build`;
  if (entity.key === "partMaster")
    return `${header}\nPRT-0001,Bracket assembly,active,mechanical`;
  return header;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "The import could not be run.";
}
