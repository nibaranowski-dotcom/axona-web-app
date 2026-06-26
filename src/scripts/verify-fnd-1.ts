/**
 * Verify FND.1 — monorepo scaffold is structurally complete.
 *
 * Run: `pnpm verify:fnd-1`  (or `pnpm tsx src/scripts/verify-fnd-1.ts`)
 * Pure structure check (Node built-ins only) — no DB/network needed.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredPaths: readonly string[] = [
  // root workspace config
  "pnpm-workspace.yaml",
  "turbo.json",
  "package.json",
  "tsconfig.json",
  ".gitignore",
  ".env.example",
  // packages/config (shared TS config + tokens home)
  "packages/config/package.json",
  "packages/config/tsconfig/base.json",
  "packages/config/src/index.ts",
  // packages/db (Prisma)
  "packages/db/package.json",
  "packages/db/prisma/schema.prisma",
  "packages/db/src/index.ts",
  // packages/agents (AgentRuntime home)
  "packages/agents/package.json",
  "packages/agents/src/index.ts",
  // apps/web (Next.js App Router)
  "apps/web/package.json",
  "apps/web/next.config.mjs",
  "apps/web/tsconfig.json",
  "apps/web/app/layout.tsx",
  // FND.13 added the shell; DS.1 moved the landing (Mission Control launchpad)
  // to the root and module screens under the (shell) group.
  "apps/web/app/page.tsx",
  "apps/web/app/(shell)/layout.tsx",
  // apps/worker (BullMQ runner)
  "apps/worker/package.json",
  "apps/worker/src/index.ts",
];

const missing = requiredPaths.filter((p) => !existsSync(join(root, p)));

if (missing.length > 0) {
  console.error(`FND.1 verify FAILED — ${missing.length} path(s) missing:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(
  `FND.1 verify OK — ${requiredPaths.length} scaffold paths present.`,
);
