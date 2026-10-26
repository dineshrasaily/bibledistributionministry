import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import type { AdminRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Server-side authorization. The JWT only carries the user id and
 * sessionVersion; role, name and activity are always re-read from the DB so
 * deactivation, 2FA resets and password changes revoke sessions at once.
 */
export type AdminActor = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type AuthzCode = "UNAUTHENTICATED" | "FORBIDDEN";

export class AuthzError extends Error {
  constructor(readonly code: AuthzCode) {
    super(code);
    this.name = "AuthzError";
  }
}

export type SessionLike = {
  user?: { id?: string | null; sessionVersion?: number | null } | null;
} | null;

export type LoadedAdmin = AdminActor & {
  isActive: boolean;
  sessionVersion: number;
};

/** Pure: session + loader -> actor, or null when the session is not valid. */
export async function resolveActor(
  session: SessionLike,
  load: (id: string) => Promise<LoadedAdmin | null>,
): Promise<AdminActor | null> {
  const id = session?.user?.id;
  if (!id) return null;
  const user = await load(id);
  if (!user || !user.isActive) return null;
  if (user.sessionVersion !== session.user?.sessionVersion) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function loadUserById(id: string): Promise<LoadedAdmin | null> {
  return prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      sessionVersion: true,
    },
  });
}

/** The signed-in admin for this request (deduped with React cache). */
export const getCurrentAdmin = cache(async (): Promise<AdminActor | null> =>
  resolveActor(await auth(), loadUserById),
);

export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getCurrentAdmin();
  if (!actor) throw new AuthzError("UNAUTHENTICATED");
  return actor;
}

export async function requireOwner(): Promise<AdminActor> {
  const actor = await requireAdmin();
  if (actor.role !== "OWNER") throw new AuthzError("FORBIDDEN");
  return actor;
}

/** For pages: redirects to the login page (keeping `next`) without a session. */
export async function requireAdminPage(path: string): Promise<AdminActor> {
  const actor = await getCurrentAdmin();
  if (!actor) redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  return actor;
}

/** For owner-only pages: editors are redirected to /admin/forbidden. */
export async function requireOwnerPage(path: string): Promise<AdminActor> {
  const actor = await requireAdminPage(path);
  if (actor.role !== "OWNER") {
    log.warn("admin.page.forbidden", { actorId: actor.id, path });
    redirect("/admin/forbidden");
  }
  return actor;
}
