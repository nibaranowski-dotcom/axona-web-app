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
        .then((r) => r.json())
        .then((data) =>
          setState({
            loading: false,
            hits: data.hits ?? [],
            byType: data.byType ?? {},
            counts: data.counts ?? { ALL: 0 },
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
