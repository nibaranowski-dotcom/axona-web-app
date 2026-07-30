import NextAuth, { type NextAuthResult, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import { verifyCredentials } from "@/lib/credentials";
import { linkGoogleUser } from "@/lib/google-sso";

// AUTH.1 — the full Auth.js instance. The Credentials provider delegates to
// verifyCredentials, which returns the session-safe user {id, orgId, role, name,
// email} or null. The hash NEVER leaves the server / enters the token or session.
//
// AUTH.SSO — the Google provider is added HERE (same instance, Node runtime) next
// to Credentials — no second auth system. It is env-gated (activates only when
// GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set, like the FakeMailer fallback).
// The `signIn` callback enforces link-by-verified-email + NO self-provision, then
// resolves the SAME claims a credentials login carries — SSO grants no authz a
// password login wouldn't, and reuses the LoginSession + tokenVersion path.
//
// The exports are annotated with NextAuthResult members to avoid TS2742 (the
// inferred types otherwise reference next-auth's internal lib paths, which pnpm
// makes non-portable).
export const googleSsoEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: (creds, request) => {
      // SET.3 — capture the device/IP for the "Sessions & devices" list.
      const device = request?.headers?.get("user-agent") ?? undefined;
      const ip =
        request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        undefined;
      return verifyCredentials(creds?.email, creds?.password, { device, ip });
    },
  }),
];

if (googleSsoEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // let a Workspace user pick the right account.
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

const nextAuth = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // AUTH.SSO — link-by-verified-email + NO self-provision. The credentials path
    // is already gated by verifyCredentials, so it passes straight through. For
    // Google, resolve the EXISTING user by verified email; on a match, carry the
    // SAME claims onto `user` so the (unchanged) jwt callback issues an identical
    // session; on no match / unverified, DENY (redirect with a legible reason) and
    // issue no session — never create a User or Org.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const linked = await linkGoogleUser({
        email: profile?.email,
        emailVerified: profile?.email_verified,
      });
      if (!linked.ok) {
        return `/login?error=${
          linked.reason === "unverified" ? "SSOUnverified" : "SSONoAccount"
        }`;
      }
      user.id = linked.user.id;
      user.orgId = linked.user.orgId;
      user.role = linked.user.role;
      user.tokenVersion = linked.user.tokenVersion;
      user.name = linked.user.name;
      user.email = linked.user.email;
      return true;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
