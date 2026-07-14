"use client";

import { create } from "zustand";

// Tiny transient store (not persisted): a pending question to seed into the
// global Axona pane (GA.1). CMD.2's copilot entry sets it + opens the pane; the
// AgentPane consumes it once. `autoSend` (UX.11) distinguishes the two entries:
//   - autoSend=false → prefill the composer (module copilot entries).
//   - autoSend=true  → SUBMIT the prompt directly (the Command Center "Ask Axona"
//     card: one click → message sent + trace starts, no prefilled box).

interface CopilotSeedState {
  seed: string | null;
  autoSend: boolean;
  setSeed: (q: string | null, autoSend?: boolean) => void;
}

export const useCopilotSeed = create<CopilotSeedState>((set) => ({
  seed: null,
  autoSend: false,
  setSeed: (seed, autoSend = false) => set({ seed, autoSend }),
}));
