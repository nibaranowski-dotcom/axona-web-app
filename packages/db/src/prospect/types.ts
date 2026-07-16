import type { Role } from "@prisma/client";
import type { OrgScopedDb } from "../client";

// PROSPECT.1 — the GENERIC prospect-demo tenant mechanism. A tailored demo lives in
// a SEPARATE org, seeded from an UNTRACKED config dir (prospects/<name>/), so the
// SEED.1 anonymization wall is never broken: the committed code here is generic and
// marque-free; nothing prospect-named is committed or scanned by verify:seed-1.
//
// A prospect config implements ProspectConfig and lives ONLY under gitignored
// prospects/<name>/prospect.config.ts. `pnpm db:seed:prospect prospects/<name>`
// upserts the org, applies its branding, seeds a demo login, then runs the config's
// own `seed()` to load the tailored data over the EXISTING models (no schema change).

export interface ProspectSeedContext {
  /** Org-scoped client for the prospect org — every write is confined to it. */
  db: OrgScopedDb;
  orgId: string;
  /** Absolute path to the config dir, so `seed()` can read local assets if needed. */
  configDir: string;
}

export interface ProspectConfig {
  /** A dedicated org id, distinct from the investor/demo org (e.g. "org_<name>_demo"). */
  orgId: string;
  /** Org display name (the prospect's brand — untracked). */
  name: string;
  slug: string;
  industry?: string;
  /** Optional logo asset (path relative to the config dir) → uploaded to the org's
   *  blob prefix and set as Org.logoKey (SET.1). Skipped when S3 isn't configured. */
  logoFile?: string;
  /** A demo login scoped to THIS org (e.g. demo@<name>-demo.test). */
  demoUser: {
    name: string;
    email: string;
    role: Role;
    password: string;
  };
  /** Load the tailored domain data over the existing models. Receives an org-scoped
   *  db, so isolation holds by construction. */
  seed(ctx: ProspectSeedContext): Promise<void>;
}
