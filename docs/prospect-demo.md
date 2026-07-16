# Prospect demo tenants (PROSPECT.1)

A **prospect demo tenant** is a tailored, realistic demo environment for a specific
sales prospect — their branding, their vocabulary, sample data shaped like their
world — seeded into a **separate org** alongside the investor/seed demo.

## The anonymization wall (why this is structured the way it is)

SEED.1 forbids real company/marque names anywhere in the **tracked** repo, and the
investor demo stays anonymized (Tier-1 Auto OEM, OEM-2, …). A prospect tenant is the
deliberate exception — so it is **walled off**:

- The **committed** code is generic and **marque-free**: the seed mechanism
  (`pnpm db:seed:prospect`), the `ProspectConfig` type, the generic per-org clear, and
  a marque-free **example** config. None of it names any prospect.
- Every **prospect-named** artifact — brand, logo, tailored data, demo login — lives
  ONLY under `prospects/<name>/`, which is **gitignored** and **excluded from the
  SEED.1 marque scan** (`verify:seed-1` stays green; `verify:prospect-1` asserts
  nothing is tracked under `prospects/`).
- Each prospect is its **own org** (`orgId`), fully isolated via `dbForOrg` — one
  tenant's data never surfaces in another's. The investor/seed demo org is untouched.

**Never commit anything prospect-named.** If you can't keep a prospect isolated, stop.

## How to add a prospect

1. Create an untracked dir: `prospects/<name>/`.
2. Add `prospects/<name>/prospect.config.ts` that default-exports a `ProspectConfig`.
   Copy `src/scripts/fixtures/prospect-example/prospect.config.ts` as the template.
   - `orgId` — a dedicated id, e.g. `org_<name>_demo` (distinct from the demo org).
   - `name` / `slug` / `industry` — the prospect's branding.
   - `logoFile` — (optional) a logo asset in the same dir → uploaded to the org's blob
     prefix and set as `Org.logoKey` (needs S3/MinIO up).
   - `demoUser` — an org-scoped login, e.g. `demo@<name>-demo.test`.
   - `seed({ db, orgId, configDir })` — load the tailored data over the **existing**
     models (no schema change): cells (`Machine`/`Robot`/`WorkOrderMfg`), inventory,
     SPC samples, NCR/ECO, the `EntityLink` graph (so `getBlastRadius` traverses the
     prospect's own cascade), and memory via `ingestMemory` (so `recallMemory` can
     surface precedent). Anonymize the prospect's downstream customers. Label
     everything **"sample data — illustrative."**
3. Seed it:

   ```
   pnpm db:seed:prospect prospects/<name>
   ```

4. Log in with the config's `demoUser` to review the branded, populated org.

## Integrity rules for prospect configs

- **Anonymize** the prospect's downstream customers (their end customers) — never name
  a real one.
- Seed **only real app capabilities** as working features; anything the product does
  not actually compute yet should be a **proposal** (the propose → approve → audit
  mechanic is real; do not fake upstream auto-compute).
- Human-gate: a prospect environment is reviewed and signed off (branding, named
  entities, sample-data labels, isolation) **before** it is shown to the prospect.
