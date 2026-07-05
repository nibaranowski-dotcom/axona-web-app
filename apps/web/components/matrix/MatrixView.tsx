"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Sparkles } from "lucide-react";
import { ScreenShell } from "@/components/shell/ScreenShell";
import type {
  MatrixCell,
  MatrixColumnDef,
  MatrixRow,
  ProjectMatrix,
} from "@/lib/matrix";
import {
  confidenceDot,
  fmtConfidence,
  fmtExt,
  fmtSize,
  isLowConfidence,
} from "./format";

export interface MatrixScreenData extends ProjectMatrix {
  projectId: string;
  projectName: string;
  moduleLabel: string;
}

// The Project Files matrix (MTX.2, matching "Project Files.dc.html" on the v2
// shell): a sticky-header table of file rows × AI-extracted columns + the
// ask-across-files bar. Each cell is an agent-drafted PROPOSAL — value + citation
// + calibrated confidence; a low-confidence cell is flagged in INK for human
// review (never presented as approved — the /// RBAC.4 approve UI is later). The
// ask bar POSTs a column (RBAC-gated) → the column fills in async (poll refetch).
// The global Axona pane (GA.1, citation-aware) stays — Core route.
export function MatrixView({ data }: { data: MatrixScreenData }) {
  const [columns, setColumns] = useState<MatrixColumnDef[]>(data.columns);
  const [rows, setRows] = useState<MatrixRow[]>(data.rows);
  const [ask, setAsk] = useState("");
  const [extracting, setExtracting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    },
    [],
  );

  const refetch = async (): Promise<ProjectMatrix | null> => {
    const res = await fetch(`/api/projects/${data.projectId}/matrix`);
    if (!res.ok) return null;
    const m = (await res.json()) as ProjectMatrix;
    setColumns(m.columns);
    setRows(m.rows);
    return m;
  };

  const pollUntilAnswered = (columnId: string, tries = 0) => {
    pollRef.current = setTimeout(async () => {
      const m = await refetch();
      const answered =
        !!m && m.rows.length > 0 && m.rows.every((r) => !!r.answers[columnId]);
      if (answered || tries >= 10) {
        setExtracting(null);
        return;
      }
      pollUntilAnswered(columnId, tries + 1);
    }, 700);
  };

  const onAsk = async () => {
    const question = ask.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${data.projectId}/columns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`add column: ${res.status}`);
      const { column } = (await res.json()) as { column: { id: string } };
      setAsk("");
      setExtracting(column.id);
      await refetch(); // the column appears immediately in an "extracting…" state
      pollUntilAnswered(column.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Column widths: metadata columns fixed; each extracted column flexes.
  return (
    <ScreenShell
      bodyClassName="gap-0 px-0 pt-0"
      header={
        <>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted">
              <Link
                href="/projects"
                className="hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Projects
              </Link>
              <span aria-hidden>/</span>
              <span className="text-ink-muted">{data.moduleLabel}</span>
            </div>
            <h1 className="mt-0.5 truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">
              {data.projectName}
            </h1>
          </div>
        </>
      }
    >
      {/* ask-across-files bar */}
      <div className="flex flex-none items-center gap-3 border-b border-line bg-paper px-6 py-[13px]">
        <div className="flex flex-1 items-center gap-2.5 rounded-btn border border-line-strong bg-panel px-3">
          <Sparkles
            className="h-[15px] w-[15px] flex-none text-ink-muted"
            strokeWidth={1.9}
            aria-hidden
          />
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onAsk();
              }
            }}
            placeholder={`Ask a question across all ${rows.length} documents — it becomes a column…`}
            aria-label="Ask a question across all documents"
            className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-muted"
          />
          <span className="flex-none font-mono text-[9px] uppercase tracking-[0.04em] text-ink-muted">
            Matrix
          </span>
        </div>
        <button
          type="button"
          onClick={() => void onAsk()}
          disabled={busy || !ask.trim()}
          className="inline-flex flex-none items-center gap-1.5 rounded-btn bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          {busy ? "Adding…" : "Add column"}
        </button>
      </div>
      {error && (
        <p
          role="status"
          className="flex-none bg-paper px-6 pb-2 font-mono text-[10px] text-ink-muted"
        >
          Couldn’t add the column — {error}
        </p>
      )}

      {/* matrix table — flows with the page (UX.4); keeps HORIZONTAL scroll for the
          wide dynamic columns. */}
      <div
        role="region"
        aria-label={`${data.projectName} file matrix`}
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <div className="min-w-max">
          {/* header */}
          <div className="sticky top-0 z-[2] flex h-[38px] items-center border-b border-line bg-panel px-6 font-mono text-[9px] uppercase tracking-[0.06em] text-ink-muted">
            <span className="w-[30px] flex-none" />
            <span className="min-w-[220px] flex-[2.4]">Document</span>
            <span className="w-[92px] flex-none">Type</span>
            <span className="min-w-[150px] flex-[1.3]">Linked to</span>
            {columns.map((c) => (
              <span
                key={c.id}
                className="flex min-w-[176px] flex-[1.5] items-center gap-1.5"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                />
                <span className="truncate">{c.question}</span>
              </span>
            ))}
            {extracting && (
              <span className="flex min-w-[176px] flex-[1.5] items-center gap-1.5 rounded-[5px] border border-line px-2 text-ink">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                />
                Extracting…
              </span>
            )}
            <span className="w-[92px] flex-none">Modified</span>
          </div>

          {/* rows */}
          {rows.map((f) => (
            <div
              key={f.fileId}
              className="flex min-h-[52px] items-center border-b border-line px-6"
            >
              <span className="w-[30px] flex-none">
                <span
                  aria-hidden
                  className="inline-block h-[15px] w-[15px] rounded-[4px] border-[1.5px] border-line-strong"
                />
              </span>
              <div className="flex min-w-[220px] flex-[2.4] items-center gap-[11px] py-2 pr-3">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-md bg-panel-2 text-ink-muted">
                  <FileText
                    className="h-[15px] w-[15px]"
                    strokeWidth={1.7}
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink">
                    {f.name}
                  </div>
                  <div className="mt-px font-mono text-[9.5px] text-ink-muted">
                    {fmtExt(f.ext)} · {fmtSize(f.sizeBytes)}
                  </div>
                </div>
              </div>
              <span className="w-[92px] flex-none">
                <span className="rounded-[5px] border border-line bg-panel px-[7px] py-0.5 font-mono text-[9px] tracking-[0.03em] text-ink-muted">
                  {f.type}
                </span>
              </span>
              <span className="min-w-[150px] flex-[1.3] truncate pr-3 font-mono text-[11px] text-ink-muted">
                {f.linkedTo ?? "—"}
              </span>
              {columns.map((c) => (
                <MatrixCellView
                  key={c.id}
                  cell={f.answers[c.id]}
                  extracting={extracting === c.id}
                />
              ))}
              {extracting && !columns.some((c) => c.id === extracting) && (
                <span className="flex min-w-[176px] flex-[1.5] items-center pr-3">
                  <ExtractingCell />
                </span>
              )}
              <span className="w-[92px] flex-none font-mono text-[10.5px] text-ink-muted">
                {relTime(f.modifiedAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}

function MatrixCellView({
  cell,
  extracting,
}: {
  cell: MatrixCell | undefined;
  extracting: boolean;
}) {
  const highlight = extracting ? "bg-panel" : "";
  return (
    <span
      className={`flex min-w-[176px] flex-[1.5] flex-col justify-center gap-0.5 py-2 pr-3 ${highlight}`}
    >
      {!cell ? (
        extracting ? (
          <ExtractingCell />
        ) : (
          <span className="font-mono text-[11px] text-ink-faint">—</span>
        )
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 flex-none rounded-full ${confidenceDot(cell.confidence)}`}
            />
            <span className="truncate text-[12.5px] text-ink">
              {cell.value}
            </span>
            {isLowConfidence(cell) && (
              <span className="flex-none rounded-pill bg-ink-strong px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.03em] text-on-dark">
                Review
              </span>
            )}
          </div>
          {cell.citation && (
            <div
              className="truncate font-mono text-[9px] text-ink-muted"
              title={cell.citation}
            >
              “{cell.citation}” · {fmtConfidence(cell.confidence)}
            </div>
          )}
        </>
      )}
    </span>
  );
}

function ExtractingCell() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
      <span
        aria-hidden
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
      />
      extracting…
    </span>
  );
}

function relTime(at: Date | string): string {
  const t = new Date(at).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
