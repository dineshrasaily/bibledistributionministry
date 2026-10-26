"use server";

import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import {
  changePasswordSchema,
  newPasswordSchema,
} from "@/lib/validation/account";
import { fieldErrorsOf } from "@/lib/validation/errors";
import { AuthzError, requireAdmin } from "@/server/auth/guards";
import {
  applyLock,
  MAX_FAILED_ATTEMPTS,
  refundCredentialAttempt,
  reserveCredentialAttempt,
} from "@/server/auth/lockout";
import { clock } from "@/server/auth/login";
import { verifyPassword } from "@/server/auth/password";
import { setOwnPassword } from "@/server/services/users";
import {
  type ActionResult,
  AUTHZ_MESSAGES,
  formDataToObject,
  runAdminAction,
  VALIDATION_MSG,
} from "./run-admin-action";

const TOO_MANY_MSG = "Too many incorrect attempts. Try again in 15 minutes.";
const WRONG_CURRENT_MSG = "Your current password is incorrect.";
const SIGNED_OUT_MSG =
  "Too many incorrect attempts. You have been signed out; sign-in is paused for 15 minutes.";

/**
 * Change own password, in two phases (section 11): Phase A checks the
 * current password outside any wrapper transaction so a failure's lockout
 * increment and its audit row persist; Phase B runs through runAdminAction.
 */
export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  let actor;
  try {
    actor = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthzError) {
      return { ok: false, code: e.code, formError: AUTHZ_MESSAGES[e.code] };
    }
    throw e;
  }

  const raw = formDataToObject(formData);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      formError: VALIDATION_MSG,
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  // Phase A: reserve an attempt before any Argon2 work.
  const now = clock.now();
  const reserved = await reserveCredentialAttempt(prisma, actor.id, now);
  if (reserved === null || reserved > MAX_FAILED_ATTEMPTS) {
    if (reserved !== null) await applyLock(prisma, actor.id, now);
    return {
      ok: false,
      code: "VALIDATION",
      formError: TOO_MANY_MSG,
      fieldErrors: { currentPassword: TOO_MANY_MSG },
    };
  }

  const user = await prisma.adminUser.findUniqueOrThrow({
    where: { id: actor.id },
    select: { passwordHash: true },
  });
  const correct = await verifyPassword(
    user.passwordHash,
    parsed.data.currentPassword,
  );
  if (!correct) {
    let locked = false;
    if (reserved === MAX_FAILED_ATTEMPTS) {
      // A session guessing passwords is treated as compromised.
      await applyLock(prisma, actor.id, now, { bumpSessionVersion: true });
      locked = true;
    }
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "auth.password.change_failed",
        entityType: "AdminUser",
        entityId: actor.id,
        metadata: { locked },
      },
    });
    log.warn("auth.password.change_failed", { actorId: actor.id, locked });
    if (locked) {
      return { ok: false, code: "UNAUTHENTICATED", formError: SIGNED_OUT_MSG };
    }
    return {
      ok: false,
      code: "VALIDATION",
      formError: WRONG_CURRENT_MSG,
      fieldErrors: { currentPassword: WRONG_CURRENT_MSG },
    };
  }
  await refundCredentialAttempt(prisma, actor.id);

  // Phase B: the mutation itself (audited, revokes all sessions).
  const result = await runAdminAction(
    {
      name: "account.password.change",
      role: "ADMIN",
      schema: newPasswordSchema,
      entityType: "AdminUser",
      revalidate: ["admin"],
      successMessage: "Password changed. Please sign in again.",
      run: setOwnPassword,
    },
    raw,
  );
  if (result.ok) await signOut({ redirectTo: "/admin/login?changed=1" });
  return result;
}
