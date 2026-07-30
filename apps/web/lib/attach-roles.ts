import type { Role } from "@axona/db";

// ATTACH.1 — the single attach/manage policy: everyone but VIEWER can attach files
// (mirrors the FILE.1 project-files upload policy). Delete is admin-only (in the
// route). Shared by the API route (enforcement) + the detail pages (canManage UI).
export const CAN_ATTACH: Role[] = [
  "ADMIN",
  "OPS",
  "ENGINEER",
  "SALES",
  "FINANCE",
  "TECH",
];
