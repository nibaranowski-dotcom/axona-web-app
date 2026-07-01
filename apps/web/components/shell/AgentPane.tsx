"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronsRight } from "lucide-react";
import { AgentGlyph } from "@/components/agents/AgentGlyph";
import { useMounted, useUi } from "@/lib/ui-store";
import { AgentRail } from "./AgentRail";
import { PaneChat } from "./PaneChat";

// The shared right agent pane (Axona v2) — resizable (drag the left handle) and
// collapsible to a rail; width + collapsed persist via the UI store (FND.13).
//
// Context-aware: on a module route (/procurement, /quality, …) it shows THAT
// module's agents as an avatar row and chats the selected one; on Core (/core,
// /, and non-module routes) it shows the general Axona agent (GA.1). Agents are
// fetched once in the shell layout (org-scoped) and picked here by route, so
// switching is instant without a server round-trip.

export interface PaneAgent {
  id: string;
  name: string;
  code: string;
  role: string;
  description: string;
  state: "LIVE" | "WORKING" | "CRITICAL" | "OFFLINE";
}

const STATE_DOT: Record<PaneAgent["state"], string> = {
  LIVE: "bg-success",
  WORKING: "bg-accent",
  CRITICAL: "bg-ink-strong",
  OFFLINE: "bg-ink-faint",
};

export function AgentPane({
  axonaAgentId,
  agentsByModule,
}: {
  axonaAgentId?: string;
  agentsByModule: Record<string, PaneAgent[]>;
}) {
  const mounted = useMounted();
  const width = useUi((s) => s.agentPaneWidth);
  const collapsed = useUi((s) => s.agentPaneCollapsed);
  const setWidth = useUi((s) => s.setAgentPaneWidth);
  const toggle = useUi((s) => s.toggleAgentPane);
  const draggingRef = useRef(false);
  const pathname = usePathname();

  const moduleKey = pathname.split("/")[1] || "core";
  const moduleAgents = agentsByModule[moduleKey] ?? [];
  const moduleMode = moduleKey !== "core" && moduleAgents.length > 0;

  // Which agent is active (module mode). Reset when the route/module changes.
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => setActiveId(null), [moduleKey]);

  const coreAgent = agentsByModule["core"]?.[0];
  const active: PaneAgent = moduleMode
    ? (moduleAgents.find((a) => a.id === activeId) ?? moduleAgents[0]!)
    : {
        id: axonaAgentId ?? coreAgent?.id ?? "",
        name: coreAgent?.name ?? "Axona agent",
        code: coreAgent?.code ?? "axona",
        role: coreAgent?.role ?? "CROSS-MODULE",
        description:
          coreAgent?.description ??
          "Reads across modules and cites sources, routing actions to the module agents.",
        state: coreAgent?.state ?? "LIVE",
      };
  const chatId = moduleMode ? active.id : (axonaAgentId ?? active.id);
  const intro = moduleMode
    ? active.description
    : "Ask across modules — I read everything and cite my sources, and route actions to the module agents.";

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setWidth(window.innerWidth - e.clientX); // anchored to the right edge
    },
    [setWidth],
  );
  const stopDrag = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [onPointerMove]);
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag);
    },
    [onPointerMove, stopDrag],
  );

  // First paint = defaults (avoid hydration mismatch); reflect store once mounted.
  if (mounted && collapsed) return <AgentRail />;

  return (
    <aside
      style={{ width: mounted ? width : 404 }}
      aria-label={moduleMode ? `${moduleKey} agents` : "Axona agent"}
      className="relative flex h-dvh flex-col border-l border-line bg-paper"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent pane"
        onPointerDown={startDrag}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-line-strong"
      />

      {/* Header — active agent identity + collapse */}
      <header className="flex h-[60px] flex-none items-center gap-3 border-b border-line px-[18px]">
        <AgentGlyph decorative tone="ink" size={26} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-ink">
            {active.name}
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-[0.05em] text-ink-muted">
            {active.role} · {active.code}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse agent pane"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-line text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </button>
      </header>

      {/* Avatar row — the module's agents (module mode only) */}
      {moduleMode && (
        <div className="flex-none border-b border-line bg-panel px-[18px] py-3">
          <div className="flex flex-wrap items-center gap-[10px]">
            {moduleAgents.map((a) => {
              const isActive = a.id === active.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  aria-label={a.name}
                  aria-pressed={isActive}
                  className={`relative inline-flex rounded-full p-[2px] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                      ? "ring-2 ring-ink-strong"
                      : "ring-1 ring-line-strong"
                  }`}
                >
                  <AgentGlyph decorative tone="ink" size={22} />
                  <span
                    aria-hidden
                    className={`absolute bottom-0 right-0 h-[7px] w-[7px] rounded-full border-[1.5px] border-panel ${STATE_DOT[a.state]}`}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-[11px] text-[12px] leading-[1.4] text-ink-muted">
            {active.description}
          </p>
          <div className="mt-[10px] flex flex-wrap gap-[7px]">
            {[moduleKey.replace(/-/g, " "), active.role, active.code].map(
              (c, i) => (
                <span
                  key={i}
                  className="rounded-[5px] border border-line-panel bg-panel px-[7px] py-[2px] font-mono text-[10px] uppercase text-ink-muted"
                >
                  {c}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      {/* Chat — keyed so switching agent/route starts a fresh thread */}
      <PaneChat
        key={chatId}
        agentId={chatId}
        intro={intro}
        placeholder={`Message ${active.name}…`}
      />
    </aside>
  );
}
