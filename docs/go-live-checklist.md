# Go-live / activation checklist

External accounts, API keys, and config needed to turn the app's stubbed/faked integrations into **real**
functionality. The app is fully built and runs today on fakes (FakeMailer, FakeModelClient, FakeEmbedder, stubbed
billing/SSO/connectors) — this list is what to wire up when you want each piece to be real.

**Owner:** Nicolas · **Env source of truth:** `.env` (local) / `.env.example` (names). Never commit real secrets.

**Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` deferred / not needed yet

IDs: **ACT-** = activate now (unblocks a built feature) · **FUT-** = future (waits on a build story) · **DEP-** = deployment only.

---

## ACT — Activate now (makes built features real)

### `ACT-1` · Resend → real transactional email  ⭐ priority
Unblocks: **AUTH.5 invites** + **AUTH.7 password reset / email verification** (today they're copyable links / FakeMailer logs).
- [ ] Create a Resend account (free tier: ~3k emails/mo).
- [ ] Verify a sending domain — use subdomain **`send.axonahq.com`** to keep it isolated from the Google MX/SPF.
- [ ] Add Resend's **DKIM** + **return-path** records in Namecheap → Advanced DNS. *(Ask Joe to verify no collision with the Google mail records before saving.)*
- [ ] Copy the API key (`re_...`).
- [ ] Set env: `RESEND_API_KEY=re_...` · `EMAIL_FROM="Axona <no-reply@send.axonahq.com>"` · `APP_URL=<app url>`.
- [ ] Restart the app → send yourself a test invite/reset and confirm receipt.

### `ACT-2` · Anthropic → real agents
Unblocks: real agent chat / workflow runs / matrix extraction (today: deterministic FakeModelClient).
- [ ] `ANTHROPIC_API_KEY=sk-ant-...` in `.env` (+ optional `ANTHROPIC_MODEL`).
- [ ] Note: likely already set locally — if so, agents already respond for real. Confirm it's present.

### `ACT-3` · Embeddings → real semantic search
Unblocks: meaningful semantic (vector) search ranking (today: deterministic FakeEmbedder; FTS + module search already work without it).
- [ ] `EMBED_API_KEY=...` · `EMBED_BASE_URL=...` · `EMBED_MODEL=...` (any OpenAI-compatible embeddings endpoint, **1536 dims**).
- [ ] Optional — search is functional without it; this only makes vector ranking real.

---

## FUT — Future (nothing to do until its build story lands)

### `FUT-1` · Stripe → real billing
Blocked on: **BILL.1** (not yet built — no `STRIPE_*` in the code). The billing *screen* (BILL.3) already works stubbed.
- [-] When BILL.1 is built: Stripe account · `sk_`/`pk_` keys · products+prices (Pilot/Scale/Enterprise) · webhook signing secret.

### `FUT-2` · SSO / SAML
Blocked on: **AUTH.2**. SET.5 has a config-only stub today.
- [-] When AUTH.2 is built: an IdP (Okta / Google Workspace SAML / Azure AD) + IdP metadata / ACS URL.

### `FUT-3` · ERP / PLM / MES / Slack connectors
Blocked on: **CONN.1**. SET.5 shows stubbed connect cards today.
- [-] When CONN.1 is built: each provider's API / OAuth credentials.

---

## DEP — Deployment only (not needed for local dev)

### `DEP-1` · Production secrets
- [ ] Strong prod `AUTH_SECRET` (`openssl rand -base64 32`) — the current one is dev-only/insecure.

### `DEP-2` · Managed infra (can all live in the same Railway project)
- [ ] `DATABASE_URL` — Postgres **with pgvector** (Railway Postgres + the `vector` extension, or Neon / Supabase / RDS).
- [ ] `REDIS_URL` — Redis for BullMQ (Railway Redis, or Upstash).
- [ ] `S3_*` — object store: a MinIO service on Railway, or external AWS S3 (+ `S3_BUCKET`/keys).

### `DEP-3` · Hosting — **Railway** (not Vercel)
- [ ] Deploy on **Railway** (already hosts axonahq.com). Create **two services in one project**:
      **web** (Next.js — `apps/web`) + **worker** (long-lived BullMQ agent/workflow runner — `apps/worker`).
      Railway runs long-lived processes natively, so the worker fits cleanly — no serverless workaround.
- [ ] Monorepo config: set each service's root dir + build/start (pnpm + Turborepo) so web and worker build independently.
- [ ] Point the app subdomain (e.g. `app.axonahq.com`) at the Railway web service; set all env vars (ACT-1/2/3 + DEP-1/2) on the services.
- [ ] Run migrations on deploy (`prisma migrate deploy`) as a release step; never `db push` (MIGRATE.1).

---

**Bottom line:** for a real, non-fake app right now you only need **ACT-1 (Resend)**, confirm **ACT-2 (Anthropic key)**, and optionally **ACT-3 (embeddings)**. Everything else waits on its build story or on deployment.
