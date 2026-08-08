"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Shell UI state — agent-pane width/collapsed + nav group open/closed.
// Persisted to localStorage; read hydration-safe via useMounted (see below).

const MIN = 320;
const MAX = 680;
const RAIL = 52;

interface UiState {
  agentPaneWidth: number; // px
  agentPaneCollapsed: boolean;
  /**
   * UX.11 — a transient "force the pane open" intent, set when the /core Ask Axona
   * card submits. It overrides `agentPaneCollapsed` in AgentPane so the pane stays
   * open (and PaneChat stays mounted to stream the answer) even though Command
   * Center's mount effect keeps re-asserting collapsed on /core. NOT persisted;
   * reset when leaving /core or on a manual collapse.
   */
  agentPaneForceOpen: boolean;
  sidebarCollapsed: boolean;
  navOpen: Record<string, boolean>; // group -> open?
  setAgentPaneWidth: (w: number) => void;
  toggleAgentPane: () => void;
  setAgentPaneCollapsed: (collapsed: boolean) => void;
  setAgentPaneForceOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** SIDEBAR.2 — set explicitly, so the SERVER's persisted value can be adopted
   *  on mount rather than blindly toggled from whatever localStorage held. */
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleNav: (group: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      agentPaneWidth: 404,
      agentPaneCollapsed: false,
      agentPaneForceOpen: false,
      sidebarCollapsed: false,
      navOpen: {
        CORE: true,
        VALUE_CHAIN: true,
        ROBOTICS: true,
        BACK_OFFICE: true,
      },
      setAgentPaneWidth: (w) =>
        set({ agentPaneWidth: Math.min(Math.max(w, MIN), MAX) }),
      toggleAgentPane: () =>
        set((s) => ({ agentPaneCollapsed: !s.agentPaneCollapsed })),
      setAgentPaneCollapsed: (agentPaneCollapsed) =>
        set({ agentPaneCollapsed }),
      setAgentPaneForceOpen: (agentPaneForceOpen) =>
        set({ agentPaneForceOpen }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleNav: (group) =>
        set((s) => ({ navOpen: { ...s.navOpen, [group]: !s.navOpen[group] } })),
    }),
    {
      name: "axona-ui",
      // agentPaneForceOpen is transient UI intent — never persist it.
      partialize: (s) => ({
        agentPaneWidth: s.agentPaneWidth,
        agentPaneCollapsed: s.agentPaneCollapsed,
        sidebarCollapsed: s.sidebarCollapsed,
        navOpen: s.navOpen,
      }),
    },
  ),
);

export const PANE_MIN = MIN;
export const PANE_MAX = MAX;
export const RAIL_WIDTH = RAIL;

/**
 * True once mounted on the client. Gate persisted-store reads behind this so the
 * first paint matches the server (defaults), avoiding hydration mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
