"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, ChevronRight, FileText } from "lucide-react";
import type { RecordAttachments, AttachmentGroup } from "@/lib/attachments";

// ATTACH.1 — the shared "Attachments" panel: the 3rd detail-view rail beside
// LINK.1 (Connected objects) + HIST.1 (History). Upload (→ POST /api/attachments →
// putObject), list current + version history, download (→ presigned URL), soft
// delete (RBAC-gated). Extracted-text availability is surfaced (FILE.2 feeds
// search/MTX/memory). v2 tokens · Lucide thin · no emoji · labelled upload+list.

export function Attachments({
  attachments,
  canManage,
  className,
}: {
  attachments: RecordAttachments;
  canManage: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { targetType, targetId, groups } = attachments;
  const canUpload = canManage && !!targetType && !!targetId;

  const onFile = (f: File | undefined) => {
    if (!f || !targetType || !targetId) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("targetType", targetType);
        fd.set("targetId", targetId);
        const res = await fetch("/api/attachments", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          setError(
            res.status === 403
              ? "You don't have permission to attach files."
              : "The upload could not be completed.",
          );
          return;
        }
        router.refresh();
      } catch {
        setError("The upload could not be completed.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  const remove = (id: string, name: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
        if (res.ok) router.refresh();
        else
          setError(
            res.status === 403
              ? "Only an admin can remove attachments."
              : `Could not remove ${name}.`,
          );
      } catch {
        setError(`Could not remove ${name}.`);
      }
    });
  };

  return (
    <section
      aria-labelledby="attachments-title"
      className={`rounded-card border border-line bg-paper p-5 ${className ?? ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="attachments-title"
          className="font-mono text-[10px] uppercase tracking-[0.07em] text-ink-muted"
        >
          Attachments
        </h2>
        {groups.length > 0 && (
          <span className="font-mono text-[11px] font-bold text-ink-strong">
            {groups.length}
          </span>
        )}
      </div>

      {canUpload && (
        <div className="mt-3">
          <input
            ref={fileRef}
            id="attach-file"
            type="file"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <label
            htmlFor="attach-file"
            className={`inline-flex items-center gap-2 rounded-btn border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              pending ? "opacity-60" : "cursor-pointer hover:border-ink-strong"
            }`}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {pending ? "Working…" : "Attach file"}
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-ink">
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-3 text-[12px] leading-[1.5] text-ink-muted">
          No files attached to this record yet.
          {canUpload
            ? " Attach specs, quotes, or reports — each is versioned, and its text is extracted for search."
            : ""}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {groups.map((g) => (
            <AttachmentRow
              key={g.name}
              g={g}
              canManage={canManage}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentRow({
  g,
  canManage,
  onRemove,
}: {
  g: AttachmentGroup;
  canManage: boolean;
  onRemove: (id: string, name: string) => void;
}) {
  const c = g.current;
  return (
    <li className="rounded-[10px] border border-line p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText
            className="mt-0.5 h-4 w-4 flex-none text-ink-faint"
            strokeWidth={1.6}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <a
                href={`/api/attachments/${c.id}`}
                className="min-w-0 truncate text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title={`Download ${g.name}`}
              >
                {g.name}
              </a>
              <span className="flex-none rounded-[4px] border border-line-panel bg-panel px-1 py-px font-mono text-[9px] uppercase tracking-[0.03em] text-ink-muted">
                v{c.version}
              </span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] leading-[1.4] text-ink-faint">
              {g.type} · {fmtSize(c.sizeBytes)}
              {c.hasText && " · text extracted"}
              {c.uploadedByLabel && ` · ${c.uploadedByLabel}`} ·{" "}
              {relTime(c.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <a
            href={`/api/attachments/${c.id}`}
            aria-label={`Download ${g.name}`}
            className="rounded-[6px] border border-line-strong p-1 text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Download className="h-3 w-3" strokeWidth={1.8} aria-hidden />
          </a>
          {canManage && (
            <button
              type="button"
              onClick={() => onRemove(c.id, g.name)}
              aria-label={`Remove ${g.name}`}
              className="rounded-[6px] border border-line-strong p-1 text-ink-muted transition-colors hover:border-ink-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.8} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {g.versionCount > 1 && (
        <details className="group mt-1.5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-[10px] uppercase tracking-[0.04em] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ChevronRight
              className="h-3 w-3 transition-transform group-open:rotate-90"
              strokeWidth={1.8}
              aria-hidden
            />
            {g.versionCount} versions
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 border-l border-line pl-2.5">
            {g.versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 font-mono text-[10.5px] text-ink-muted"
              >
                <a
                  href={`/api/attachments/${v.id}`}
                  className="underline decoration-line-strong underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  v{v.version}
                </a>
                <span className="text-ink-faint">
                  {fmtSize(v.sizeBytes)} · {relTime(v.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function relTime(at: Date | string): string {
  const ms = Date.now() - new Date(at).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
