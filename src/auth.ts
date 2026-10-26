import "server-only";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { authorizeAdminTotp } from "@/server/auth/login";

/**
 * Auth.js v5: JWT sessions (8 h, refreshed every 15 min). A session can only
 * be minted through `completeLogin` (challenge + TOTP), so even a direct POST
 * to /api/auth/callback/admin-totp needs a valid step-1 challenge.
 * Cookies keep the Auth.js defaults (HttpOnly, SameSite=Lax, Secure on https).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8, updateAge: 60 * 15 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    Credentials({
      id: "admin-totp",
      name: "Admin",
      credentials: { challenge: {}, code: {} },
      authorize: (raw) => authorizeAdminTotp(raw),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.sv = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      // Role/name shown in the admin always come from the DB (guards.ts);
      // these are only the lookup keys.
      const t = token as JWT;
      session.user.id = t.uid ?? "";
      session.user.role = t.role ?? "EDITOR";
      session.user.sessionVersion = t.sv ?? -1;
      return session;
    },
  },
});
