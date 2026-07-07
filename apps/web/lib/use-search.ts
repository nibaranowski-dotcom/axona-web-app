"use client";

import { useEffect, useState } from "react";
import type { SearchHit, SearchScope } from "@axona/db";

// Debounced (~150ms), abortable search against /api/search (SRCH.2). Stale
// requests are cancelled so the last query wins. counts come back in the same
// response (no second call).

export interface SearchState {
  loading: boolean;
  hits: SearchHit[];
  byType: Record<string, SearchHit[]>;
  counts: Record<string, number>;
  error?: string;
  // SRCH.5 — the FTS portion degraded (module results still returned). A soft
  // notice, NOT a blank-out: results are still shown.
  degraded?: boolean;
}

const IDLE: SearchState = {
  loading: false,
  hits: [],
  byType: {},
  counts: { ALL: 0 },
};

export function useSearch(query: string, scope: SearchScope): SearchState {
  const [state, setState] = useState<SearchState>(IDLE);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState(IDLE);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: undefined }));
      fetch(
        `/api/search?q=${encodeURIComponent(q)}&scope=${encodeURIComponent(scope)}`,
        { signal: ctrl.signal },
      )
        // Only a real transport/5xx failure is "unavailable". A 200 with zero
        // hits is a legitimate no-match (the palette shows a No-results state) —
        // never masked as an error. A 200 with `degraded: true` means the FTS
        // portion fell back but module (and any) results still returned — shown
        // with a soft notice, never a blank-out. (SRCH.4 / SRCH.5)
        .then((r) => {
          if (!r.ok) throw new Error(`search failed: ${r.status}`);
          return r.json();
        })
        .then((data) =>
          setState({
            loading: false,
            hits: data.hits ?? [],
            byType: data.byType ?? {},
            counts: data.counts ?? { ALL: 0 },
            degraded: data.degraded === true,
          }),
        )
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setState({ ...IDLE, error: "Search unavailable" });
        });
    }, 150);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, scope]);

  return state;
}
