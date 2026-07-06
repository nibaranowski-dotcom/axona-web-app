import NextAuth, { type NextAuthResult } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { verifyCredentials } from "@/lib/credentials";

// AUTH.1 — the full Auth.js instance. The Credentials provider delegates to
// verifyCredentials (bcryptjs against User.passwordHash), which returns the
// session-safe user {id, orgId, role, name, email} or null. The passwordHash
// NEVER leaves the server / enters the token or session.
//
// The exports are annotated with NextAuthResult members to avoid TS2742 (the
// inferred types otherwise reference next-auth's internal lib paths, which pnpm
// makes non-portable).
const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (creds) => verifyCredentials(creds?.email, creds?.password),
    }),
  ],
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
