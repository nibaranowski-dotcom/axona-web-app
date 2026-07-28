# Deploy runbook — Axona on Railway (GOLIVE.2)

Production target: **all services on Railway** — WEB (`apps/web`) + WORKER (`apps/worker`)
+ Postgres + Redis; blob store = **Cloudflare R2** (S3-compatible). The coming-soon
marketing site stays separate for now.

This runbook is authored under **GOLIVE.2a (prep only — nothing here was deployed,
provisioned, or set as a secret)**. Executing it is **GOLIVE.2b**.

**Each step is tagged `[NICOLAS]` (dashboard / secrets / DNS — human only) or
`[CLAUDE-CODE]` (repo + deploy trigger).** Do the steps in order.

## Guardrails (apply to every step)

- **Secrets never touch the repo or chat.** Set every value in the Railway dashboard
  (Service → Variables). `.env.production.example` lists names + sources only.
- **Migrations = `prisma migrate deploy`, NEVER `prisma db push` (MIGRATE.1).** The WEB
  service's `railway.json` runs `migrate deploy` as its release step.
- **GIT.1** — this repo pushes ONLY to `nibaranowski-dotcom/axona-web-app`. Never a
  `pemo-io` remote. The pre-push hook enforces it.
- Existing CI + `verify:all` + the pre-push hook still gate every push.

---

## Step 0 — `[NICOLAS]` Inspect current Railway state (do this FIRST)

The prep block couldn't reach the Railway CLI from the sandbox, so run these yourself
and paste the output back (the variables command lists **names only** — no secret
values reach chat):

```
! railway whoami
! railway status
! railway list
! railway variables --kv 2>/dev/null | cut -d= -f1      # NAMES ONLY (values redacted)
```

Then confirm in the dashboard: is there a **Postgres** plugin? a **Redis** plugin? a
**web** service? a **worker** service? And **what is bound to `axonahq.com` / any
`*.axonahq.com`** today (Service → Settings → Networking → Custom Domains)? A Railway
404 at `axonahq.com` means a service claims the domain but isn't serving — note which
service that is, and where the coming-soon marketing site is deployed. This determines
the domain plan in Step 6.

---

## Step 1 — `[NICOLAS]` Provision the data stores + blob store

1. **Railway Postgres** — if the inspection shows none, add the Postgres plugin to the
   project (New → Database → PostgreSQL). It exposes `DATABASE_URL`.
   - Note: production Postgres needs the `pgvector` extension (MEM.1 / FILE.2 embeddings).
     Railway's Postgres supports `CREATE EXTENSION vector` — the first migration that
     needs it will create it, but confirm the plugin image allows extensions. If not,
     use a `pgvector`-enabled Postgres image.
2. **Railway Redis** — if none, add the Redis plugin (New → Database → Redis). Exposes
   `REDIS_URL`.
3. **Cloudflare R2** — create a bucket (e.g. `axona-files`) and an **R2 API token**
   (Account → R2 → Manage API Tokens → Create) scoped to that bucket. Capture the
   Access Key ID + Secret Access Key and the account's S3 endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## Step 2 — `[NICOLAS]` Create the two Railway services (config-as-code)

From the GitHub repo `nibaranowski-dotcom/axona-web-app`, create **two services** in the
Railway project, each connected to the repo:

| Service  | Root Directory | Config file            | Public port |
| -------- | -------------- | ---------------------- | ----------- |
| `web`    | `/` (repo root)| `apps/web/railway.json`| yes ($PORT) |
| `worker` | `/` (repo root)| `apps/worker/railway.json` | no      |

Set each service's **Root Directory = `/`** and **Config-as-Code path** to its
`railway.json` (Service → Settings → Config-as-Code). Each `railway.json` points at its
Dockerfile (`apps/web/Dockerfile` / `apps/worker/Dockerfile`), which prunes the monorepo
to that app. The build context is the repo root — do **not** set the root dir to the app
folder.

Enable **Deploy on push to `main`** for both services (auto-deploy via the GitHub
integration) — that is how `[CLAUDE-CODE]` triggers deploys in Step 4.

## Step 3 — `[NICOLAS]` Set the environment variables (dashboard only)

Using `.env.production.example` as the checklist, set every value in the Railway
dashboard. Shared vars (DB, Redis, R2, Anthropic, embeddings) go on **both** services;
`AUTH_SECRET` / `AUTH_URL` / `APP_URL` / `RESEND_API_KEY` / `EMAIL_FROM` are WEB-only.

- Wire the stores with plugin references: `DATABASE_URL = ${{Postgres.DATABASE_URL}}`,
  `REDIS_URL = ${{Redis.REDIS_URL}}`.
- `AUTH_SECRET` — generate once: `openssl rand -base64 32`.
- `APP_URL` / `AUTH_URL` — set to the app URL from Step 6 (e.g. `https://app.axonahq.com`).
  It's fine to deploy first on the Railway-generated `*.up.railway.app` URL and update
  these once the custom domain is bound.
- Never paste any of these into chat or the repo.

## Step 4 — `[CLAUDE-CODE]` Deploy web + worker

With Steps 1–3 done, trigger the deploys:

- **Preferred:** push to `main` (the GitHub integration auto-builds both services). CI +
  the pre-push hook run first; Railway builds each Dockerfile and deploys.
- **Alternative (if the Railway CLI is available + linked):** `railway up` per service.

Watch each service's build + deploy logs to green.

## Step 5 — `[CLAUDE-CODE]` Migrations (`prisma migrate deploy`)

Migrations run **automatically** as the WEB service's release step — `railway.json`
`deploy.preDeployCommand` = `pnpm --filter @axona/db exec prisma migrate deploy`, run
against `DATABASE_URL` before the new version goes live. **Never `db push`.**

- Verify in the WEB deploy logs that `migrate deploy` applied cleanly and
  `migrate status` is current.
- Manual fallback (only if the release step is misconfigured), from a Railway shell on
  the WEB service: `pnpm --filter @axona/db exec prisma migrate deploy`.
- **No production seed.** `db:seed` is demo data — do NOT run it against prod.

## Step 6 — `[NICOLAS]` Bind the domain + DNS

**Proposed app domain: `app.axonahq.com`** (leaves the apex `axonahq.com` for the
coming-soon marketing site).

- **⚠ Flag / decision from Step 0:** if the inspection shows the apex `axonahq.com` (or a
  Railway service) already claims a domain and returns a 404, do **not** repoint the apex
  to the app — that would take down / shadow the marketing site. Use the `app.` subdomain
  for the product and leave the apex on the marketing deployment. If Step 0 reveals a
  genuine conflict (e.g. the marketing site is itself on this Railway project under the
  apex), resolve it explicitly with Nicolas before binding.
- On the WEB service → Settings → Networking → Custom Domain, add `app.axonahq.com`.
  Railway shows a `CNAME` target.
- In Cloudflare DNS: add `app` → the Railway CNAME target (DNS-only / grey cloud first to
  avoid proxy/cert races; you can enable the proxy after the cert issues).
- After the domain is live, update `APP_URL` + `AUTH_URL` to `https://app.axonahq.com`
  and redeploy WEB (Step 4) so auth callbacks + invite/SAML links use the real origin.

## Step 7 — `[CLAUDE-CODE]` Smoke test

Against the live app URL:

- `GET https://app.axonahq.com/api/health` → `200 {"status":"ok","service":"axona-web",…}`
  (this is the Railway healthcheck target).
- `GET https://app.axonahq.com/login` → `200`, the login page renders.
- Sign in with a real seeded/created admin; confirm `/core` loads (DB + session work).
- Trigger one background job (e.g. a file upload / a workflow run) and confirm the WORKER
  logs pick it up (Redis + worker wired).

## Rollback

- **Fast rollback:** Railway → the service → Deployments → pick the last-good deployment →
  **Redeploy** (or "Rollback"). Both services roll back independently.
- **Migrations:** `migrate deploy` is forward-only. A bad migration is rolled *forward*
  with a new corrective migration (author via `prisma migrate dev` locally → commit →
  deploy) — never edit an applied migration, never `db push`. If a migration half-applied,
  fix-forward from a Railway shell with a new migration; restore from a Railway Postgres
  backup only as a last resort.
- **Domain:** if the app domain misbehaves, remove the custom domain in Railway and fall
  back to the `*.up.railway.app` URL (and revert `APP_URL`/`AUTH_URL`) while you debug.

## Notes / later

- The coming-soon marketing site (and, later, the full marketing site) is a **separate**
  service/deploy — out of scope for GOLIVE.2. Keep it on the apex; the product lives on
  `app.`.
- `turbo prune` keeps each image to just its app's deps. If build time/size matters later,
  a Next `output: "standalone"` runner is a follow-up optimization (not needed to ship).
