import type { OrgScopedDb } from "../../src";

// Demo identities covering every Role (AUTH.1 gives them a real password). Seeded
// via dbForOrg so orgId is injected. Emails are globally unique, so they're
// namespaced per org.
//
// AUTH.1 dev password — all 7 role users share ONE dev password so the demo can
// log in as any role. The PLAINTEXT lives only in docs/manual-checks.md; here we
// store its bcrypt hash (one-way, safe to commit). Default: admin@axona-demo.test.
const DEV_PASSWORD_HASH =
  "$2b$10$dFdaqk2nrpMGQiIZXV8X0eQWUCtDUOZQ73n5Z.iS6kzDGWV/CGcqe";

const USERS: { name: string; email: string; role: RoleStr }[] = [
  { name: "Dana Reyes", email: "admin@axona-demo.test", role: "ADMIN" },
  { name: "Omar Haddad", email: "ops@axona-demo.test", role: "OPS" },
  { name: "Priya Nair", email: "engineer@axona-demo.test", role: "ENGINEER" },
  { name: "Sam Park", email: "sales@axona-demo.test", role: "SALES" },
  { name: "Lena Fischer", email: "finance@axona-demo.test", role: "FINANCE" },
  { name: "M. Osei", email: "tech@axona-demo.test", role: "TECH" },
  { name: "Guest Viewer", email: "viewer@axona-demo.test", role: "VIEWER" },
];

type RoleStr =
  | "ADMIN"
  | "OPS"
  | "ENGINEER"
  | "SALES"
  | "FINANCE"
  | "TECH"
  | "VIEWER";

export async function seedUsers(db: OrgScopedDb): Promise<number> {
  for (const u of USERS) {
    await db.user.create({
      data: { ...u, passwordHash: DEV_PASSWORD_HASH },
    });
  }
  return USERS.length;
}
