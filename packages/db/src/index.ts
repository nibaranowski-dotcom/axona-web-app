/**
 * @axona/db — Prisma schema, migrations, the org-scoped client, and pagination.
 *
 * Request paths use `dbForOrg(orgId)` (ISO.1 tenant isolation enforced by an
 * extension); the bare `prisma` is for migrations/seed/system tasks only.
 */
export { prisma, dbForOrg } from "./client";
export type { OrgScopedDb } from "./client";
export { paginateArgs, pageResult } from "./pagination";
export type { PageArgs } from "./pagination";

// Re-export Prisma's generated types/enums so consumers import from one place.
export * from "@prisma/client";

export const DB_PACKAGE = "@axona/db" as const;
