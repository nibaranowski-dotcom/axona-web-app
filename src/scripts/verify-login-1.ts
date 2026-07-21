/**
 * Verify LOGIN.1 — the recurring /login 500 is fixed and cannot recur.
 * Static + pure checks always run (these are the CI regression guards); the
 * runtime HTTP checks run only when a dev server is reachable on :3001.
 * Run: pnpm verify:login-1
 *
 * Root cause (see specs/PRD-LOGIN.1.md): the root layout rendered the ⌘K
 * <CommandPalette/> (a "use client" component). A fresh browser probes
 * /.well-known/appspecific/com.chrome.devtools.json first, which made Next 14 dev
 * compile the synthetic /_not-found before /login; that mis-wired the root
 * layout's client component so CommandPalette ran server-side and threw
 * `useRef of null`. With no root error boundary, every route sharing the root
 * layout — /login first — 500-ed.
 *
 *   1. Regression guard: the ROOT layout no longer imports/renders CommandPalette.
 *   2. ⌘K still works: the palette is mounted by (shell)/layout + the launcher.
 *   3. No unhandled-throw path: a root global-error boundary + not-found exist and
 *      render the designed state (so any throw is caught, never a raw 500).
 *   4. Middleware treats /login as public in every branch of authorized().
 *   5. AUTH.1 login contract intact (LoginForm → signIn("credentials")).
 *   6. (runtime) The poisoning sequence — devtools probe THEN /login ×3 — returns
 *      200 unauthenticated; a protected route redirects to /login.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = async (
  label: string,
  fn: () => boolean | Promise<boolean>,
): Promise<void> => {
  try {
    const ok = await fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

async function run(): Promise<void> {
  console.log(
    "\nVerifying LOGIN.1 — the /login 500 is fixed and cannot recur\n",
  );
  const root = process.cwd();
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

  // ── 1 (static): the root layout must NOT render the palette (the crash node) ──
  const rootLayout = read("apps/web/app/layout.tsx");
  await check(
    "root layout does NOT import/render CommandPalette (the /login 500 trigger)",
    () =>
      rootLayout.length > 0 &&
      !/CommandPalette/.test(rootLayout) &&
      !/import .*search\/CommandPalette/.test(rootLayout),
  );

  // ── 2 (static): the palette IS mounted where it belongs (client-only), so ⌘K
  //    still works — but it never server-renders (the SSR of this client component
  //    was the crash). Mounted via CommandPaletteMount (next/dynamic ssr:false). ──
  const shellLayout = read("apps/web/app/(shell)/layout.tsx");
  const launcher = read("apps/web/components/core/Launcher.tsx");
  const mount = read("apps/web/components/search/CommandPaletteMount.tsx");
  await check(
    "palette mounted client-only (ssr:false) — never server-renders (no useRef-null SSR crash)",
    () => {
      const importsMount = (s: string) =>
        /<CommandPaletteMount\s*\/>/.test(s) &&
        /search\/CommandPaletteMount/.test(s) &&
        !/<CommandPalette\s*\/>/.test(s); // the raw (SSR-able) palette is not mounted here
      return (
        /"use client"/.test(mount) &&
        /ssr:\s*false/.test(mount) &&
        /import\(.*\.\/CommandPalette.*\)/.test(mount) &&
        importsMount(shellLayout) && // all (shell) screens
        importsMount(launcher) // /launcher + /search
      );
    },
  );

  // ── 3 (static): no unhandled-throw path — root boundaries render designed state ──
  const globalError = read("apps/web/app/global-error.tsx");
  const notFound = read("apps/web/app/not-found.tsx");
  await check(
    "root global-error boundary exists (own <html>, reset action) — any throw → error state, not 500",
    () =>
      globalError.length > 0 &&
      /"use client"/.test(globalError) &&
      /<html/.test(globalError) &&
      /onClick=\{reset\}/.test(globalError) && // retry re-renders the failed segment
      /export default function/.test(globalError),
  );
  await check(
    "root not-found boundary exists (designed 404) — replaces the synthetic /_not-found default",
    () =>
      notFound.length > 0 &&
      /export default function/.test(notFound) &&
      // must NOT re-introduce a client-only surface into the not-found tree
      !/CommandPalette/.test(notFound),
  );

  // ── 4 (static): middleware treats /login as public in every authorized() branch ──
  const authConfig = read("apps/web/auth.config.ts");
  await check(
    "/login is public in every matcher branch (PUBLIC list + isPublic → allow())",
    () => {
      const publicList =
        authConfig.match(/const PUBLIC = \[([\s\S]*?)\]/)?.[1] ?? "";
      const authorizedBody =
        authConfig.match(/authorized\(\{[\s\S]*?\n {4}\}/)?.[0] ?? authConfig;
      return (
        /\/\^\\\/login/.test(publicList) && // /^\/login/ is in PUBLIC
        /isPublic = PUBLIC\.some/.test(authorizedBody) &&
        // the public branch returns allow() (only logged-in /login redirects home)
        /if \(isPublic\)/.test(authorizedBody) &&
        /return allow\(\);/.test(authorizedBody) &&
        /pages: \{ signIn: "\/login" \}/.test(authConfig)
      );
    },
  );

  // ── 5 (static): AUTH.1 login contract intact ──
  const loginForm = read("apps/web/components/auth/LoginForm.tsx");
  const loginPage = read("apps/web/app/login/page.tsx");
  await check(
    "login contract intact: page renders LoginForm; form calls signIn('credentials')",
    () =>
      /LoginForm/.test(loginPage) && /signIn\(\s*"credentials"/.test(loginForm),
  );

  // ── 6 (runtime): the actual poisoning sequence returns 200, unauthenticated ──
  const base = process.env.LOGIN1_BASE_URL ?? "http://localhost:3001";
  const reachable = await fetch(`${base}/login`, {
    redirect: "manual",
    signal: AbortSignal.timeout(2500),
  })
    .then(() => true)
    .catch(() => false);

  if (!reachable) {
    console.log(
      `  SKIP runtime checks — no dev server on ${base} (static guards above are the CI gate)`,
    );
  } else {
    // Fire the devtools well-known probe FIRST (what a fresh browser does), then
    // hit /login three times — the exact sequence that used to 500.
    await fetch(`${base}/.well-known/appspecific/com.chrome.devtools.json`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);

    await check(
      "unauthenticated /login returns 200 after the devtools probe (×3, incl. repeats)",
      async () => {
        for (let i = 0; i < 3; i++) {
          const res = await fetch(`${base}/login`, {
            redirect: "manual",
            signal: AbortSignal.timeout(8000),
          });
          if (res.status !== 200) return false;
          const html = await res.text();
          if (!/Sign in to your workspace/.test(html)) return false;
        }
        return true;
      },
    );

    await check(
      "a protected route (/core) redirects unauthenticated → /login (middleware gates)",
      async () => {
        const res = await fetch(`${base}/core`, {
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });
        return (
          res.status === 307 &&
          (res.headers.get("location") ?? "").includes("/login")
        );
      },
    );
  }

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run().then(() => process.exit(failed > 0 ? 1 : 0));
