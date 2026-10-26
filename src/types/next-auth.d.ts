import type { DefaultSession } from "next-auth";
import type { AdminRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AdminRole;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: AdminRole;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AdminRole;
    sv?: number;
  }
}
