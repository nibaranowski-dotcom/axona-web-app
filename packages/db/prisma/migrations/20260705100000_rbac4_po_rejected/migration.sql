-- RBAC.4 — a human can reject a PO at the approval gate. POStatus had no terminal
-- "rejected" state, so add one bounded enum value (the only non-forward status).
ALTER TYPE "POStatus" ADD VALUE 'REJECTED';
