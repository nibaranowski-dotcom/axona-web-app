import type { NextAuthConfig, Session } from "next-auth";
import { NextResponse } from "next/server";

// AUTH.1 — the EDGE-SAFE Auth.js config (no Node-only deps: no prisma, no bcrypt),
// shared by the middleware and the full config in auth.ts. The Credentials
// provider (which needs prisma + bcrypt) is added only in auth.ts, so the
// middleware bundle stays edge-compatible.

// Public routes (no session required). Auth.js's own /api/auth/* + static assets
// are additionally excluded by the middleware matcher.
const PUBLIC = [
  /^\/login/,
  /^\/signup/,
  /^\/reset/,
  /^\/verify/, // AUTH.7 — email verification link
  /^\/invite/,
  /^\/api\/auth/,
];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Trust the deployment host (dev + CI); real hosts are pinned by env in prod.
  trustHost: true,
  providers: [], // Credentials provider added in auth.ts (Node runtime)
  callbacks: {
    // Route protection — runs in the middleware. Unauthenticated app requests
    // redirect to /login?next=…; authenticated users on /login bounce to /.
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const path = nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const isPublic = PUBLIC.some((re) => re.test(path));

      // Allow the request through, carrying the pathname on a request header so
      // server components (the shell layout) can gate on the current route
      // (AUTH.6 module enablement) without re-deriving it. Edge-safe.
      const allow = () => {
        const headers = new Headers(request.headers);
        headers.set("x-pathname", path);
        return NextResponse.next({ request: { headers } });
      };

      if (isPublic) {
        if (isLoggedIn && /^\/login/.test(path)) {
          return NextResponse.redirect(new URL("/", nextUrl));
        }
        return allow();
      }
      if (isLoggedIn) return allow();

      const login = new URL("/login", nextUrl);
      login.searchParams.set("next", path + nextUrl.search);
      return NextResponse.redirect(login);
    },
    // Carry orgId + role onto the token, then expose on the session. NEVER the hash.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.orgId = user.orgId;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion; // SET.3
      }
      return token;
    },
    session({ session, token }) {
      // token.* are set in the jwt callback above; the v5 JWT type is loose, so
      // narrow them back to the session-user shape here.
      session.user.id = String(token.id ?? "");
      session.user.orgId = String(token.orgId ?? "");
      session.user.role = token.role as Session["user"]["role"];
      session.user.tokenVersion = Number(token.tokenVersion ?? 0); // SET.3
      return session;
    },
  },
} satisfies NextAuthConfig;
// (explicit annotation avoids TS2742 portability errors with pnpm + next-auth v5)
