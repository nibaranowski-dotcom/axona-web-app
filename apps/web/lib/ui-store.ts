"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Shell UI state — agent-pane width/collapsed + nav group open/closed.
// Persisted to localStorage; read hydration-safe via useMounted (see below).

const MIN = 280;
const MAX = 520;
const RAIL = 52;

interface UiState {
  agentPaneWidth: number; // px
  agentPaneCollapsed: boolean;
  navOpen: Record<string, boolean>; // group -> open?
  setAgentPaneWidth: (w: number) => void;
  toggleAgentPane: () => void;
  toggleNav: (group: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      agentPaneWidth: 340,
      agentPaneCollapsed: false,
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
      toggleNav: (group) =>
        set((s) => ({ navOpen: { ...s.navOpen, [group]: !s.navOpen[group] } })),
    }),
    { name: "axona-ui" },
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
