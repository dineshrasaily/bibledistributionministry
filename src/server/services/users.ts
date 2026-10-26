import "server-only";
import { prisma } from "@/lib/db";
import { PASSWORD_IS_EMAIL_MSG } from "@/lib/validation/common";
import type { NewPasswordInput } from "@/lib/validation/account";
import type {
  CreateEditorInput,
  SetEditorPasswordInput,
  SetUserActiveInput,
} from "@/lib/validation/users";
import type { AdminActor } from "@/server/auth/guards";
import { hashPassword } from "@/server/auth/password";
import {
  DomainError,
  EditorLimitError,
  MAX_ACTIVE_EDITORS,
} from "@/server/errors";
import type { ServiceResult, Tx } from "./shared";

/**
 * Admin users (OWNER only). This module owns the "max 3 active editors"
 * invariant: creates and reactivations are serialized by a transaction-level
 * advisory lock, then counted.
 */
export const EDITOR_LOCK_KEY = 42001;
export const OWNER_LOCKED_MSG = "The owner account can't be changed here.";

export function listAdmins() {
  return prisma.adminUser.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
    },
  });
}

export function countActiveEditors(): Promise<number> {
  return prisma.adminUser.count({
    where: { role: "EDITOR", isActive: true },
  });
}

async function assertEditorSlot(tx: Tx): Promise<void> {
  // Literal key (EDITOR_LOCK_KEY): avoids parameter type inference for bigint.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(42001)`;
  const active = await tx.adminUser.count({
    where: { role: "EDITOR", isActive: true },
  });
  if (active >= MAX_ACTIVE_EDITORS) throw new EditorLimitError();
}

async function editorOrThrow(tx: Tx, id: string) {
  const user = await tx.adminUser.findUniqueOrThrow({ where: { id } });
  if (user.role !== "EDITOR") {
    throw new DomainError("FORBIDDEN", OWNER_LOCKED_MSG);
  }
  return user;
}

export async function createEditor(
  tx: Tx,
  input: CreateEditorInput,
): Promise<ServiceResult<{ id: string }>> {
  await assertEditorSlot(tx);
  const user = await tx.adminUser.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "EDITOR",
      totpEnabled: false,
    },
    select: { id: true },
  });
  return {
    entityId: user.id,
    metadata: { role: "EDITOR" },
    data: { id: user.id },
  };
}

/** Deactivation revokes sessions; reactivation re-checks the limit. */
export async function setUserActive(
  tx: Tx,
  input: SetUserActiveInput,
): Promise<ServiceResult> {
  const user = await editorOrThrow(tx, input.id);
  if (input.active && !user.isActive) await assertEditorSlot(tx);
  await tx.adminUser.update({
    where: { id: input.id },
    data: {
      isActive: input.active,
      ...(input.active ? {} : { sessionVersion: { increment: 1 } }),
    },
  });
  return {
    entityId: input.id,
    metadata: { isActive: { from: user.isActive, to: input.active } },
  };
}

/** The editor enrols a new authenticator on next sign-in. */
export async function resetEditorTotp(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  await editorOrThrow(tx, input.id);
  await tx.adminUser.update({
    where: { id: input.id },
    data: {
      totpSecretEnc: null,
      totpEnabled: false,
      lastTotpStep: null,
      sessionVersion: { increment: 1 },
    },
  });
  await tx.loginChallenge.deleteMany({ where: { userId: input.id } });
  return { entityId: input.id, metadata: { totpEnabled: false } };
}

/** Temporary password set by the owner: revokes sessions and unlocks. */
export async function setEditorPassword(
  tx: Tx,
  input: SetEditorPasswordInput,
): Promise<ServiceResult> {
  const user = await editorOrThrow(tx, input.id);
  if (input.password.toLowerCase() === user.email) {
    throw new DomainError("VALIDATION", PASSWORD_IS_EMAIL_MSG, "password");
  }
  await tx.adminUser.update({
    where: { id: input.id },
    data: {
      passwordHash: await hashPassword(input.password),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  return { entityId: input.id, metadata: { changed: ["password"] } };
}

/** Phase B of changePasswordAction (any admin, own account). */
export async function setOwnPassword(
  tx: Tx,
  input: NewPasswordInput,
  actor: AdminActor,
): Promise<ServiceResult> {
  if (input.newPassword.toLowerCase() === actor.email) {
    throw new DomainError("VALIDATION", PASSWORD_IS_EMAIL_MSG, "newPassword");
  }
  await tx.adminUser.update({
    where: { id: actor.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  return { entityId: actor.id, metadata: { changed: ["password"] } };
}
