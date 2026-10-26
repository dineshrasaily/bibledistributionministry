"use server";

import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import QRCode from "qrcode";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { safeNext } from "@/lib/safe-next";
import { loginStep1Schema, loginStep2Schema } from "@/lib/validation/auth";
import { fieldErrorsOf } from "@/lib/validation/errors";
import { AuthzError, requireAdmin } from "@/server/auth/guards";
import {
  beginLogin,
  CHALLENGE_COOKIE,
  CHALLENGE_TTL_MS,
  EXPIRED_MSG,
  GENERIC_MSG,
  hashToken,
  INVALID_CODE_MSG,
  InvalidLoginError,
  type LoginState,
} from "@/server/auth/login";
import { clientIp } from "@/server/auth/rate-limit";

/** Step 1 (public): email + password. */
export async function startLoginAction(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const next = safeNext(formData.get("next"));
  const parsed = loginStep1Schema.safeParse({
    email: formData.get("email") ?? undefined,
    password: formData.get("password") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      step: "credentials",
      fieldErrors: fieldErrorsOf(parsed.error),
      next,
    };
  }

  const requestHeaders = await headers();
  const result = await beginLogin(parsed.data, {
    ip: clientIp(requestHeaders),
  });
  if (!result.ok) {
    return {
      ok: false,
      step: "credentials",
      formError: result.formError,
      next,
    };
  }

  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: CHALLENGE_TTL_MS / 1000,
    secure: requestHeaders.get("x-forwarded-proto") === "https",
  });

  if (result.step === "verify") return { ok: true, step: "verify", next };
  const qrSvg = await QRCode.toString(result.otpauthUri, {
    type: "svg",
    margin: 1,
  });
  return {
    ok: true,
    step: "enroll",
    next,
    enrollment: { otpauthUri: result.otpauthUri, secret: result.secret, qrSvg },
  };
}

/** Step 2 (public): authenticator code; a session is minted only by authorize. */
export async function completeLoginAction(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const step = formData.get("step") === "enroll" ? "enroll" : "verify";
  const next = safeNext(formData.get("next"));
  const parsed = loginStep2Schema.safeParse({
    code: formData.get("code") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, step, fieldErrors: fieldErrorsOf(parsed.error), next };
  }

  const jar = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return { ok: false, step: "credentials", formError: EXPIRED_MSG, next };
  }

  try {
    await signIn("admin-totp", {
      challenge,
      code: parsed.data.code,
      redirect: false,
    });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof InvalidLoginError) {
      if (e.code === "invalid_code") {
        return {
          ok: false,
          step,
          fieldErrors: { code: INVALID_CODE_MSG },
          next,
        };
      }
      jar.delete(CHALLENGE_COOKIE);
      return { ok: false, step: "credentials", formError: EXPIRED_MSG, next };
    }
    // Errors inside authorize (bad key, tampered secret, DB) arrive as CallbackRouteError.
    log.error("auth.login.error", {
      name: (e as Error)?.name,
      cause: (e as { cause?: { err?: Error } })?.cause?.err?.name,
    });
    jar.delete(CHALLENGE_COOKIE);
    return { ok: false, step: "credentials", formError: GENERIC_MSG, next };
  }

  jar.delete(CHALLENGE_COOKIE);
  redirect(next ?? "/admin");
}

/** "Start over": forget the pending challenge. */
export async function cancelLoginAction(): Promise<LoginState> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  if (token) {
    await prisma.loginChallenge.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  jar.delete(CHALLENGE_COOKIE);
  return { ok: false, step: "credentials" };
}

/** Logs out everywhere: bumps sessionVersion (revokes copied JWTs). */
export async function logoutAction(): Promise<void> {
  let actorId: string | null = null;
  try {
    const actor = await requireAdmin();
    actorId = actor.id;
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: actor.id },
        data: { sessionVersion: { increment: 1 } },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "auth.logout",
          entityType: "AdminUser",
          entityId: actor.id,
        },
      }),
    ]);
  } catch (e) {
    if (!(e instanceof AuthzError)) {
      log.error("auth.logout.error", { actorId, name: (e as Error)?.name });
    }
  }
  await signOut({ redirectTo: "/admin/login" });
}
