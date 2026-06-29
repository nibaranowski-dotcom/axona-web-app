// Shared tool helpers.

/** Cap list-tool results so the model context doesn't blow up. */
export const LIST_CAP = 50;

/**
 * Generate a human-readable record code for a freshly drafted entity (PO-..,
 * NCR-.., ECO-..). Idempotency on retry is a workflow concern (WF.1).
 */
export function genCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
