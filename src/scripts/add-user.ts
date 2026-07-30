import { prisma } from "@axona/db";
import { addUserToOrg } from "./lib/add-user-core";

// ADMIN.1 — `db:add-user`: provision a real user into an org without ad-hoc SQL.
// SSO-ready (no password; they sign in via Google — AUTH.SSO links by email),
// idempotent by email. CLI/admin only — never a public endpoint.
//
//   pnpm db:add-user --email you@company.com --org <orgId|slug> --role ADMIN --name "Your Name"

const USAGE =
  'Usage: pnpm db:add-user --email you@company.com --org <orgId|slug> --role ADMIN --name "Your Name"\n' +
  "  --role  ADMIN | OPS | ENGINEER | SALES | FINANCE | TECH | VIEWER";

function arg(flag: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? "") : "";
}

async function main(): Promise<void> {
  const res = await addUserToOrg({
    email: arg("--email"),
    org: arg("--org"),
    role: arg("--role"),
    name: arg("--name"),
  });

  if (!res.ok) {
    console.error(`add-user — ${res.error}\n\n${USAGE}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `user ${res.email} (${res.role}) in org ${res.orgName} — ${res.action}; sign in via Google SSO (email-linked).`,
  );
  console.log(
    `  no credentials password set — SSO-only (they can set one later via "Forgot password?" on /login).`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("add-user failed:", (e as Error).message);
  await prisma.$disconnect();
  process.exit(1);
});
