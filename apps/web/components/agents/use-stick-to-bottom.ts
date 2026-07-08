"use client";

import { useEffect, useRef } from "react";

// UX.10 — keep the message-list scroll container pinned to the newest message.
// Returns a ref to attach to the scroll container; whenever `dep` changes (a
// message appended / streamed) it scrolls to the bottom. Under prefers-reduced-
// motion the browser already renders the jump instantly (scrollTop is not
// animated), so no extra guard is needed.
export function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}
