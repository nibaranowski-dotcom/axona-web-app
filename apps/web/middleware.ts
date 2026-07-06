import NextAuth, { type NextAuthResult } from "next-auth";
import { authConfig } from "./auth.config";

// AUTH.1 — protected-route middleware. Uses the EDGE-SAFE authConfig (no prisma /
// bcrypt) so it runs at the edge; the `authorized` callback decodes the JWT from
// the cookie and redirects unauthenticated app requests to /login?next=…, and
// authenticated users on /login back to /. (NextAuthResult annotation → no TS2742.)
const { auth } = NextAuth(authConfig);
export const middleware: NextAuthResult["auth"] = auth;
export default middleware;

// Run on everything except static assets + files with an extension.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
