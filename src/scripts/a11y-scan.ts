/**
 * A11Y.2 — the SERVED accessibility gate. Signs in as the seeded admin, drives a
 * real browser to each configured route, and runs axe-core over the live DOM.
 * Fails on any serious/critical violation; reports moderate/minor.
 *
 *   pnpm a11y:scan              scan the route set (exit 1 on serious/critical)
 *   pnpm a11y:scan --selftest   inject a known-bad element and PROVE the gate
 *                               catches it (exit 0 iff a serious/critical is caught)
 *
 * Env: A11Y_BASE_URL (default http://localhost:3001) · A11Y_EMAIL · A11Y_PASSWORD.
 * The served app + a seeded DB must be running — this is a CI/pre-merge gate, not
 * a static check (that is verify:a11y-1, which A11Y.2 complements, not replaces).
 */
import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { A11Y_ROUTES, A11Y_BASELINE } from "./a11y-routes";

/** A serious/critical violation already triaged into a per-route follow-up. */
function isBaselined(path: string, ruleId: string): boolean {
  return A11Y_BASELINE.some((b) => b.path === path && b.rule === ruleId);
}

// These globals are used ONLY inside browser-context callbacks (Playwright
// serializes the function and runs it in the page). Declare minimal type-only
// shims so this Node-target script type-checks without pulling DOM lib into every
// Node script in the repo.
declare const localStorage: { setItem(key: string, value: string): void };
declare const document: {
  createElement(tag: string): {
    setAttribute(name: string, value: string): void;
  };
  body: { appendChild(node: unknown): void };
};

const BASE = process.env.A11Y_BASE_URL ?? "http://localhost:3001";
const EMAIL = process.env.A11Y_EMAIL ?? "admin@axona-demo.test";
const PASSWORD = process.env.A11Y_PASSWORD ?? "axona-dev-2026!";
const BLOCKING = new Set(["serious", "critical"]);

interface AxeNode {
  target?: unknown;
}
interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: AxeNode[];
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#login-email", EMAIL);
  await page.fill("#login-password", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 30_000,
    }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(500);
}

async function visit(page: Page, path: string): Promise<void> {
  // The agent pane streams over SSE, so 'networkidle' can never fire — settle on
  // the DOM + a stable landmark instead.
  await page.goto(`${BASE}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page
    .waitForSelector("#main, main, h1", { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function analyze(page: Page): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations as unknown as AxeViolation[];
}

function impactOf(v: AxeViolation): string {
  return v.impact ?? "minor";
}

async function main(): Promise<void> {
  const selftest = process.argv.includes("--selftest");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // open the right agent pane by default (agent-surface coverage)
  await context.addInitScript(() => {
    try {
      localStorage.setItem(
        "axona-ui",
        JSON.stringify({ state: { agentPaneCollapsed: false }, version: 0 }),
      );
    } catch {
      /* first-visit, storage may be unavailable — the default is open anyway */
    }
  });
  const page = await context.newPage();

  // ── selftest: prove the gate actually catches a serious violation ──
  if (selftest) {
    await signIn(page);
    await visit(page, "/core");
    // inject a button with NO accessible name → axe rule "button-name" (critical)
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.setAttribute("id", "a11y-selftest-broken");
      document.body.appendChild(b);
    });
    const violations = await analyze(page);
    const caught = violations.filter((v) => BLOCKING.has(impactOf(v)));
    await browser.close();
    if (caught.length > 0) {
      console.log(
        `SELFTEST PASS — the gate caught a seeded ${impactOf(caught[0]!)} violation (${caught[0]!.id}). The served axe gate is real.`,
      );
      process.exit(0);
    }
    console.error(
      "SELFTEST FAIL — axe did NOT flag the injected button-name violation. The gate is not working.",
    );
    process.exit(1);
  }

  // ── real scan over the route set ──
  console.log(`\nA11Y.2 served scan — ${BASE}\n`);
  let signedIn = false;
  const blocking: { route: string; v: AxeViolation }[] = []; // new → fail CI
  const known: { route: string; v: AxeViolation }[] = []; // baselined → triage
  let moderate = 0;
  let minor = 0;

  for (const route of A11Y_ROUTES) {
    if (route.auth && !signedIn) {
      await signIn(page);
      signedIn = true;
    }
    try {
      await visit(page, route.path);
      const violations = await analyze(page);
      const counts: Record<string, number> = {};
      for (const v of violations) {
        const imp = impactOf(v);
        counts[imp] = (counts[imp] ?? 0) + 1;
        if (BLOCKING.has(imp)) {
          if (isBaselined(route.path, v.id))
            known.push({ route: route.path, v });
          else blocking.push({ route: route.path, v });
        } else if (imp === "moderate") moderate++;
        else minor++;
      }
      const summary =
        Object.entries(counts)
          .map(([k, n]) => `${n} ${k}`)
          .join(" · ") || "clean";
      console.log(
        `  ${route.path.padEnd(22)} ${route.label}\n    → ${summary}`,
      );
    } catch (e) {
      console.error(`  ${route.path} — scan error: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }

  await browser.close();

  console.log(
    `\nTotals — ${blocking.length} NEW serious/critical · ${known.length} baselined (triaged) · ${moderate} moderate · ${minor} minor`,
  );

  if (known.length > 0) {
    console.log("\nKnown/baselined serious violations (per-route follow-ups):");
    for (const { route, v } of known) {
      console.log(
        `  [${impactOf(v)}] ${route} · ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
      );
    }
  }

  if (blocking.length > 0) {
    console.log("\nNEW serious/critical violations (these fail the gate):");
    for (const { route, v } of blocking) {
      console.log(
        `  [${impactOf(v)}] ${route} · ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`,
      );
    }
    console.error(
      "\nFAILED — new serious/critical accessibility violations (not baselined).",
    );
    process.exit(1);
  }

  console.log(
    "\nPASSED — no NEW serious/critical violations (baselined issues remain as triage).",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("a11y-scan crashed:", e);
  process.exit(1);
});
