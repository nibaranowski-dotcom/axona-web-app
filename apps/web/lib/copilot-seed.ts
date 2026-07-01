"use client";

import { create } from "zustand";

// Tiny transient store (not persisted): a pending question to seed into the
// global Axona pane (GA.1). CMD.2's copilot entry sets it + opens the pane; the
// AgentPane consumes it once to prefill its composer. No second chat is built.

interface CopilotSeedState {
  seed: string | null;
  setSeed: (q: string | null) => void;
}

export const useCopilotSeed = create<CopilotSeedState>((set) => ({
  seed: null,
  setSeed: (seed) => set({ seed }),
}));
