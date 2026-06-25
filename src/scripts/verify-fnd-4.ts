/**
 * Verify FND.4 — CI + git hooks + shared lint/format config.
 *
 * Run: `pnpm verify:fnd-4`
 * Static checks (Node built-ins only):
 *   1. Git hooks present + executable; pre-push blocks main; prepare wires hooksPath.
 *   2. ESLint + Prettier shared config resolves from @axona/config; every
 *      workspace consumes it and has a real (non-echo) lint script.
 *   3. CI workflow exists with install/lint/typecheck/verify on push + PR.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

const read = (rel: string): string => {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(p, "utf8");
};
const isExecutable = (rel: string): boolean => {
  const p = join(root, rel);
  if (!existsSync(p)) return false;
  return (statSync(p).mode & 0o111) !== 0;
};

// --- 1. Git hooks ------------------------------------------------------------
const preCommit = read(".husky/pre-commit");
if (!preCommit.includes("lint-staged")) fail("pre-commit must run lint-staged");
if (!isExecutable(".husky/pre-commit"))
  fail(".husky/pre-commit is not executable");

const prePush = read(".husky/pre-push");
if (!isExecutable(".husky/pre-push")) fail(".husky/pre-push is not executable");
if (!/branch.*=.*main/s.test(prePush) || !prePush.includes("exit 1")) {
  fail("pre-push must block direct pushes to main");
}
if (!prePush.includes("typecheck") || !prePush.includes("verify")) {
  fail("pre-push must run typecheck + verify");
}

const rootPkg = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
  ["lint-staged"]?: Record<string, unknown>;
  devDependencies?: Record<string, string>;
};
if (!rootPkg.scripts?.prepare?.includes("core.hooksPath")) {
  fail("root prepare script must set core.hooksPath (.husky)");
}
if (!rootPkg["lint-staged"])
  fail("root package.json missing lint-staged config");

// --- 2. Shared ESLint + Prettier config -------------------------------------
const cfgPkg = JSON.parse(read("packages/config/package.json")) as {
  exports?: Record<string, string>;
};
if (cfgPkg.exports?.["./eslint"] !== "./eslint/base.cjs") {
  fail('@axona/config must export "./eslint" -> ./eslint/base.cjs');
}
if (cfgPkg.exports?.["./prettier"] !== "./prettier.config.cjs") {
  fail('@axona/config must export "./prettier" -> ./prettier.config.cjs');
}
if (!existsSync(join(root, "packages/config/eslint/base.cjs"))) {
  fail("packages/config/eslint/base.cjs missing");
}
if (!existsSync(join(root, "packages/config/prettier.config.cjs"))) {
  fail("packages/config/prettier.config.cjs missing");
}

// shared dev deps present at root
for (const dep of [
  "eslint",
  "prettier",
  "eslint-config-prettier",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "lint-staged",
]) {
  if (!rootPkg.devDependencies?.[dep])
    fail(`root devDependency missing: ${dep}`);
}

// every workspace consumes the shared config + has a real lint script
const workspaces = [
  "packages/config",
  "packages/db",
  "packages/agents",
  "apps/web",
  "apps/worker",
];
for (const ws of workspaces) {
  const eslintrc = read(`${ws}/.eslintrc.cjs`);
  const usesShared =
    eslintrc.includes("@axona/config/eslint") ||
    eslintrc.includes("./eslint/base.cjs");
  if (!usesShared)
    fail(`${ws}/.eslintrc.cjs does not extend the shared config`);

  const pkg = JSON.parse(read(`${ws}/package.json`)) as {
    scripts?: Record<string, string>;
  };
  const lint = pkg.scripts?.lint ?? "";
  if (!lint || lint.startsWith("echo")) fail(`${ws} has no real lint script`);
}

// --- 3. CI workflow ----------------------------------------------------------
const ci = read(".github/workflows/ci.yml");
for (const needle of [
  "pull_request",
  "branches: [main]",
  "pnpm install",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm verify:all",
]) {
  if (!ci.includes(needle)) fail(`ci.yml missing: ${needle}`);
}

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`FND.4 verify FAILED — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "FND.4 verify OK — hooks executable (pre-commit/pre-push), shared eslint/prettier consumed by all workspaces, CI workflow present.",
);
