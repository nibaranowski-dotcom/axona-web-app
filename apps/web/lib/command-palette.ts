"use client";

import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { SearchScope } from "@axona/db";

// Global ⌘K command-palette open state. Ephemeral (no persistence). Mounted once
// at the root so it works on the / launchpad and inside the shell (SRCH.3).
//
// Singleton guard: this store is imported by components that land in several
// route chunks (root layout, shell layout, launcher, /search). To guarantee ONE
// instance across chunks — so the sidebar/launcher triggers update the same store
// CommandPalette reads — we pin it on globalThis.

interface PaletteState {
  open: boolean;
  query: string;
  scope: SearchScope;
  openPalette: (seed?: string) => void;
  close: () => void;
  toggle: () => void;
  setQuery: (q: string) => void;
  setScope: (s: SearchScope) => void;
}

type PaletteStore = UseBoundStore<StoreApi<PaletteState>>;

const globalRef = globalThis as unknown as {
  __axonaCommandPalette?: PaletteStore;
};

export const useCommandPalette: PaletteStore =
  globalRef.__axonaCommandPalette ??
  (globalRef.__axonaCommandPalette = create<PaletteState>((set) => ({
    open: false,
    query: "",
    scope: "ALL",
    openPalette: (seed = "") => set({ open: true, query: seed, scope: "ALL" }),
    close: () => set({ open: false }),
    toggle: () => set((s) => ({ open: !s.open })),
    setQuery: (q) => set({ query: q }),
    setScope: (s) => set({ scope: s }),
  })));
