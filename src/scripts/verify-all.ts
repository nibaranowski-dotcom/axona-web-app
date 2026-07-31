/**
 * VERIFY.3 — the sequential verify harness. Replaces the 155-link
 * `pnpm verify:a && pnpm verify:b && …` chain in package.json.
 *
 *   pnpm verify:all                     run the whole gate
 *   pnpm verify:all --from=proc-1       resume at a story (debugging)
 *   pnpm verify:all --only=cmd-1,mem-2  run a subset
 *
 * Why a runner and not a shell chain:
 *   1. **Order is data.** The sequence lives here, and a parity self-check fails
 *      loudly if package.json gains a `verify:*` script that is not in it — the
 *      chain silently drifted before.
 *   2. **Bounded connect-retry.** 155 short-lived processes each open their own
 *      Prisma pool. Under that churn a script intermittently died on P1001
 *      ("Can't reach database server") mid-run even though the DB was healthy and
 *      the script passed in isolation. The runner holds ONE shared client, pings
 *      the DB before each script, and waits for it to come back instead of letting
 *      the gate go red on a transport hiccup.
 *   3. **Real errors.** A step that dies without printing (an uncaught rejection,
 *      an OOM) used to surface as a bare non-zero exit. Output is captured and the
 *      tail is replayed on failure, with the exit code and the detected reason.
 *
 * A transient is retried ONCE and reported as RETRIED — it never masks a failed
 * assertion. Anything that isn't a known connection signature fails immediately.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The gate, in dependency order (foundation → data/API → screens → moat → fixes).
const VERIFY_SEQUENCE: string[] = [
  "fnd-1",
  "fnd-2",
  "fnd-3",
  "fnd-4",
  "fnd-5",
  "fnd-6",
  "fnd-7",
  "fnd-8",
  "fnd-9",
  "fnd-10",
  "fnd-11",
  "fnd-12",
  "fnd-13",
  "mc-1",
  "srch-1",
  "srch-2",
  "ds-1",
  "srch-3",
  "art-1",
  "art-2",
  "art-4",
  "agt-1",
  "ga-1",
  "cmd-1",
  "cmd-2",
  "proc-1",
  "proc-2",
  "qual-1",
  "qual-2",
  "eng-1",
  "eng-2",
  "ful-1",
  "ful-2",
  "fleet-1",
  "fleet-2",
  "field-1",
  "field-2",
  "auto-1",
  "auto-2",
  "fin-1",
  "fin-2",
  "legal-1",
  "legal-2",
  "mfg-1",
  "mfg-2",
  "ppl-1",
  "ppl-2",
  "sec-1",
  "sec-2",
  "sales-1",
  "sales-2",
  "mkt-1",
  "mkt-2",
  "mach-1",
  "proj-1",
  "srch-4",
  "srch-5",
  "srch-6",
  "wf-1",
  "wfl-1",
  "wfl-2",
  "ux-1",
  "ux-2",
  "ux-3",
  "ux-4",
  "ux-5",
  "ux-6",
  "ux-7",
  "ux-8",
  "ux-9",
  "ux-10",
  "ux-11",
  "a11y-1",
  "migrate-1",
  "inv-1",
  "inv-2",
  "file-1",
  "file-2",
  "mtx-1",
  "mtx-2",
  "audit-1",
  "audit-2",
  "audit-3",
  "rbac-4",
  "rbac-5",
  "auth-1",
  "auth-4",
  "auth-5",
  "auth-6",
  "auth-7",
  "set-1",
  "set-2",
  "set-3",
  "set-4",
  "set-5",
  "bill-3",
  "notif-1",
  "email-1",
  "demo-3",
  "ont-1",
  "seed-1",
  "ux-12",
  "mem-1",
  "ux-13",
  "prospect-1",
  "prospect-2",
  "prospect-3",
  "conf-1",
  "login-1",
  "house-1",
  "plm-1a",
  "plm-2",
  "plm-3",
  "plm-4",
  "plm-5",
  "plm-v3",
  "plm-v4",
  "audit-4",
  "runtime-1",
  "a11y-2",
  "a11y-3",
  "plm-1b",
  "plm-6",
  "plm-7",
  "plm-v2",
  "plm-8",
  "plm-9",
  "plm-v1",
  "plm-10",
  "plm-11",
  "plm-12",
  "plm-v5",
  "plm-v6",
  "agt-3",
  "ux-14",
  "sidebar-1",
  "seams-1",
  "mem-2",
  "eval-1",
  "trust-1",
  "loop-1",
  "lead-1",
  "golive-1",
  "io-1",
  "link-1",
  "hist-1",
  "attach-1",
  "auth-sso",
  "admin-1",
  "br-1",
  "mfx-1",
  "prospect-plm",
  "demo-5",
  "io-2",
  "ux-16",
  "verify-3",
  "ci-1",
  "verify-4",
];

/** Prisma/pg errors that mean "the transport blipped", never "the check failed". */
const TRANSIENT = [
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1017", // server closed the connection
  "P2024", // timed out fetching a connection from the pool
  "Can't reach database server",
  "Timed out fetching a new connection",
  "Connection terminated unexpectedly",
  "ECONNRESET",
  "ECONNREFUSED",
];

const ROOT = process.cwd();
const scripts = (
  JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

/** Fail loudly if a `verify:*` script exists but is not gated by the sequence. */
function checkParity(): void {
  const keys = Object.keys(scripts)
    .filter((k) => k.startsWith("verify:") && k !== "verify:all")
    .map((k) => k.slice("verify:".length));
  const inSeq = new Set(VERIFY_SEQUENCE);
  const missing = keys.filter((k) => !inSeq.has(k));
  const stale = VERIFY_SEQUENCE.filter((k) => !scripts[`verify:${k}`]);
  if (missing.length || stale.length) {
    console.log(
      "\n  FAIL verify:all sequence is out of sync with package.json",
    );
    if (missing.length)
      console.log(
        `    not gated (add to VERIFY_SEQUENCE): ${missing.join(", ")}`,
      );
    if (stale.length)
      console.log(
        `    gated but no such script:            ${stale.join(", ")}`,
      );
    process.exit(1);
  }
  const dupes = VERIFY_SEQUENCE.filter(
    (k, i) => VERIFY_SEQUENCE.indexOf(k) !== i,
  );
  if (dupes.length) {
    console.log(
      `\n  FAIL duplicate entries in VERIFY_SEQUENCE: ${dupes.join(", ")}`,
    );
    process.exit(1);
  }
}

const env = {
  ...process.env,
  PATH: `${join(ROOT, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
};

function runStep(id: string): { code: number; output: string } {
  const cmd = scripts[`verify:${id}`]!;
  const r = spawnSync(cmd, {
    shell: true,
    env,
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status ?? 1,
    output: `${r.stdout ?? ""}${r.stderr ?? ""}`,
  };
}

const isTransient = (out: string): string | null =>
  TRANSIENT.find((sig) => out.includes(sig)) ?? null;

/**
 * Wait for the database to answer before handing the next script a dead socket.
 * One shared client for the whole run — the point of the exercise.
 */
interface DbPing {
  $queryRawUnsafe: (q: string) => Promise<unknown>;
  $disconnect: () => Promise<void>;
}

async function waitForDb(prisma: DbPing): Promise<boolean> {
  const DELAYS = [0, 250, 500, 1000, 2000, 4000];
  let last = "";
  for (const wait of DELAYS) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return true;
    } catch (e) {
      last = (e as Error).message.split("\n")[0] ?? String(e);
    }
  }
  console.log(`  DB unreachable after ${DELAYS.length} attempts — ${last}`);
  return false;
}

async function main(): Promise<void> {
  checkParity();

  const only = arg("only");
  const from = arg("from");
  let seq = VERIFY_SEQUENCE;
  if (only) seq = only.split(",").map((s) => s.trim());
  else if (from) {
    const i = VERIFY_SEQUENCE.indexOf(from);
    if (i < 0) {
      console.log(`\n  FAIL --from=${from} is not in the sequence`);
      process.exit(1);
    }
    seq = VERIFY_SEQUENCE.slice(i);
  }

  // The shared client exists only to keep the DB warm + answer the preflight ping.
  // Skipped entirely without DATABASE_URL (CI runs the gate DB-less; the DB-gated
  // checks skip themselves cleanly).
  let prisma: DbPing | null = null;
  if (process.env.DATABASE_URL) {
    // @axona/db's `prisma` is already the process-wide dev singleton (one client,
    // one pool) — reuse it rather than opening a 156th connection of our own.
    prisma = (await import("@axona/db")).prisma as unknown as DbPing;
    if (!(await waitForDb(prisma))) process.exit(1);
  }

  console.log(`\nverify:all — ${seq.length} checks\n`);
  const started = Date.now();
  const retried: string[] = [];
  let failedId: string | null = null;
  let failure = "";

  for (const id of seq) {
    if (prisma && !(await waitForDb(prisma))) {
      failedId = id;
      failure = "database unreachable before the step could start";
      break;
    }

    let { code, output } = runStep(id);

    if (code !== 0) {
      const sig = isTransient(output);
      if (sig) {
        console.log(
          `  RETRY verify:${id} — transient (${sig}); the DB blipped, re-running once`,
        );
        if (prisma) await waitForDb(prisma);
        ({ code, output } = runStep(id));
        if (code === 0) retried.push(id);
      }
    }

    process.stdout.write(output);

    if (code !== 0) {
      failedId = id;
      const sig = isTransient(output);
      failure = sig
        ? `exit ${code} — still failing after a retry (transient signature: ${sig})`
        : `exit ${code}`;
      if (!output.trim())
        failure +=
          " — the step produced NO output (uncaught rejection or a crash)";
      break;
    }
  }

  await prisma?.$disconnect();

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log("\n" + "─".repeat(66));
  if (failedId) {
    console.log(`verify:all FAILED at verify:${failedId} — ${failure}`);
    console.log(`  reproduce: pnpm verify:${failedId}`);
    console.log(`  resume:    pnpm verify:all --from=${failedId}`);
    if (retried.length)
      console.log(`  retried (transient, then passed): ${retried.join(", ")}`);
    console.log(`  ${mins} min`);
    process.exit(1);
  }
  console.log(`verify:all PASSED — ${seq.length} checks in ${mins} min`);
  if (retried.length)
    console.log(
      `  ${retried.length} retried after a transient DB blip: ${retried.join(", ")}`,
    );
  console.log("");
}

void main();
