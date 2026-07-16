/**
 * PROSPECT.1 — seed a prospect demo tenant (GENERIC, marque-free).
 *
 *   pnpm db:seed:prospect <configDir>
 *   e.g.  pnpm db:seed:prospect prospects/<name>
 *
 * <configDir> is an UNTRACKED directory (prospects/ is gitignored) holding a
 * `prospect.config.ts` that default-exports a ProspectConfig. This runner upserts a
 * SEPARATE org, applies its branding + demo login, and runs the config's own seed().
 * Nothing prospect-named is committed — the SEED.1 anonymization wall stays intact.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prisma, type ProspectConfig } from "@axona/db";
import { seedProspectOrg } from "./lib/prospect-seed";

async function main(): Promise<void> {
  const dirArg = process.argv[2];
  if (!dirArg) {
    console.error("usage: pnpm db:seed:prospect <configDir>");
    console.error("  e.g. pnpm db:seed:prospect prospects/<name>");
    process.exit(1);
  }
  const configDir = resolve(process.cwd(), dirArg);
  const configPath = resolve(configDir, "prospect.config.ts");
  if (!existsSync(configPath)) {
    console.error(`No prospect.config.ts found in ${dirArg}`);
    console.error("See docs/prospect-demo.md for the config shape.");
    process.exit(1);
  }

  const mod = (await import(pathToFileURL(configPath).href)) as {
    default?: ProspectConfig;
    config?: ProspectConfig;
  };
  const config = mod.default ?? mod.config;
  if (!config?.orgId || typeof config.seed !== "function") {
    console.error(
      `${configPath} must default-export a ProspectConfig ({ orgId, name, slug, demoUser, seed }).`,
    );
    process.exit(1);
  }

  const result = await seedProspectOrg(config, { configDir });
  console.log(
    `Prospect tenant seeded — org "${result.name}" (${result.orgId})` +
      `${result.logoUploaded ? " · logo uploaded" : ""}` +
      ` · login ${config.demoUser.email}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
