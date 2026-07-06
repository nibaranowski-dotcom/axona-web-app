import type { Role } from "@axona/db";
import type { DefaultSession } from "next-auth";

// AUTH.1 — carry the tenant boundary (orgId) + role on the session + JWT. These
// are set by the jwt/session callbacks; passwordHash is NEVER part of either.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    orgId: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    orgId: string;
    role: Role;
  }
}
