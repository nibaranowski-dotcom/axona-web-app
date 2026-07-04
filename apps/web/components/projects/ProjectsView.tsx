"use client";

import Link from "next/link";

import { FileText, Plus } from "lucide-react";
import type { ProjectRow, ProjectsData } from "@/lib/projects";
import { useUi } from "@/lib/ui-store";
import { useCopilotSeed } from "@/lib/copilot-seed";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { STATUS_BADGE, fmtAgo } from "./format";

export interface ProjectsScreenData extends ProjectsData {
  now: number;
}

const COLS = "grid grid-cols-[2.4fr_1fr_1.1fr_0.9fr] items-center gap-[14px]";

// The Projects screen (PROJ.1, matching Projects.dc.html on the v2 shell): the
// workspaces grouped module-separated, each row's file count / member avatars /
// status / last-activity. Read-only; the side pane is the GENERAL Axona agent
// (GA.1, cross-project). Opening a project → the per-project file MATRIX is MTX.2
// (deferred) — rows show the file COUNT and route to the agent to summarize.
// "New project" / assign are agent-drafted, gated (RBAC.4/AUDIT.3) — deferred.
export function ProjectsView({
  data,
  error = false,
}: {
  data: ProjectsScreenData;
  error?: boolean;
}) {
  const setSeed = useCopilotSeed((s) => s.setSeed);
  const setCollapsed = useUi((s) => s.setAgentPaneCollapsed);
  const propose = (prompt: string) => {
    setSeed(prompt);
    setCollapsed(false);
  };

  const r = data.rollup;
  const hasData = r.total > 0;
  const stats = [
    { v: r.total, l: "Projects" },
    { v: r.modules, l: "Modules" },
    { v: r.files, l: "Files" },
    { v: r.needsAttention, l: "Need attention" },
  ];

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Topbar (60px) */}
      <header className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-paper px-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
            Core · workspaces by module
          </div>
          <h1 className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
            Projects
          </h1>
        </div>
        <button
          type="button"
          onClick={() =>
            propose("Start a new project workspace and add its files")
          }
          className="inline-flex items-center gap-1.5 rounded-btn bg-ink-strong px-4 py-[9px] text-[13.5px] font-semibold text-on-dark transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          New project
        </button>
      </header>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-sm text-ink-muted">
            Couldn’t load projects. Check the database and refresh.
          </p>
        </div>
      ) : !hasData ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-ink-muted">
            No projects — run the seed (
            <span className="font-mono">pnpm db:seed</span>).
          </p>
        </div>
      ) : (
        <>
          {/* stat strip */}
          <div className="flex flex-none flex-wrap items-center gap-x-[18px] gap-y-2 border-b border-line bg-paper px-6 py-[13px]">
            {stats.map((s) => (
              <div key={s.l}>
                <span className="text-[16px] font-bold text-ink">{s.v}</span>
                <span className="ml-1 font-mono text-[9.5px] uppercase tracking-[0.04em] text-ink-muted">
                  {s.l}
                </span>
              </div>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
            {data.groups.map((g) => (
              <div key={g.moduleKey}>
                <div className="mb-2 mt-[18px] flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] flex-none rounded-[2px] bg-ink-strong"
                  />
                  <span className="text-[13px] font-semibold text-ink">
                    {g.module}
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {g.count} {g.count === 1 ? "project" : "projects"}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </div>
                {g.projects.map((p) => (
                  <ProjectRowView key={p.id} p={p} now={data.now} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectRowView({ p, now }: { p: ProjectRow; now: number }) {
  const badge = STATUS_BADGE[p.status];
  const humans = p.humanMembers.slice(0, 3);
  const extraHumans = p.humanMembers.length - humans.length;
  return (
    <Link
      href={`/projects/${p.id}`}
      className={`${COLS} mb-2 w-full rounded-card border border-line bg-paper px-3.5 py-[13px] text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-ink">
          {p.name}
        </div>
        <div className="mt-[3px] truncate text-[12px] text-ink-muted">
          {p.description}
        </div>
      </div>
      <div className="flex items-center gap-[7px] font-mono text-[11px] text-ink-muted">
        <FileText
          className="h-[13px] w-[13px] flex-none"
          strokeWidth={1.8}
          aria-hidden
        />
        {p.fileCount} files
      </div>
      <div className="flex items-center">
        {Array.from({ length: Math.min(3, p.agentCount) }).map((_, i) => (
          <span
            key={`a${i}`}
            className="-mr-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-paper bg-panel-2"
          >
            <AgentGlyph decorative size={13} />
          </span>
        ))}
        {humans.map((h, i) => (
          <span
            key={`h${i}`}
            title={h}
            className="-mr-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-paper bg-accent font-mono text-[8.5px] font-bold text-accent-ink"
          >
            {h
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </span>
        ))}
        {extraHumans > 0 && (
          <span className="ml-2.5 font-mono text-[10px] text-ink-muted">
            +{extraHumans}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end gap-[5px]">
        <span
          className={`inline-flex items-center rounded-pill px-[9px] py-[3px] text-[10px] font-semibold tracking-[0.03em] ${badge.cls}`}
        >
          {badge.label}
        </span>
        <span className="font-mono text-[9.5px] text-ink-muted">
          {fmtAgo(p.updatedAt, now)}
        </span>
      </div>
    </Link>
  );
}
