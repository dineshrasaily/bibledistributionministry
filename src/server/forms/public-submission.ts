import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import type { FormKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { fieldErrorsOf } from "@/lib/validation/errors";
import {
  formRateLimit,
  type PublicFormState,
} from "@/lib/validation/public-forms";
import { formDataToObject } from "@/server/actions/run-admin-action";
import { clientIp, hashIp } from "@/server/auth/rate-limit";
import {
  notifyNewSubmission,
  type SubmissionKind,
} from "@/server/notify/email";
import { reserveFormSubmission } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

/**
 * The one pipeline every PUBLIC form submission goes through:
 * honeypot -> Zod -> rate limit (hashed IP) -> Turnstile -> create -> notify.
 * Plain server helper (no server-action directive), so it is never an
 * endpoint itself. Logs never contain names, emails, bodies or raw IPs.
 */
export type PublicSubmissionDef<S extends z.ZodType> = {
  form: FormKind;
  schema: S;
  /** Turnstile `action` the widget was rendered with. */
  turnstileAction: string;
  create: (input: z.output<S>) => Promise<{ id: string }>;
  notifyKind: SubmissionKind;
};

/** Hidden field real people never fill in. */
export const HONEYPOT_FIELD = "website";

export async function runPublicSubmission<S extends z.ZodType>(
  def: PublicSubmissionDef<S>,
  formData: FormData,
): Promise<PublicFormState> {
  const form = def.notifyKind;
  try {
    const raw = formDataToObject(formData);

    // 1. Honeypot: pretend success, store nothing.
    const trap = raw[HONEYPOT_FIELD];
    if (typeof trap === "string" && trap.trim() !== "") {
      log.info("form.honeypot", { form });
      return { status: "success" };
    }

    // 2. Validation (no DB access for invalid input).
    const parsed = def.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        status: "error",
        code: "VALIDATION",
        fieldErrors: fieldErrorsOf(parsed.error),
      };
    }

    // 3. Rate limit per hashed IP (the raw IP is never stored or logged).
    const ipHash = hashIp(clientIp(await headers()));
    const { limited } = await reserveFormSubmission(prisma, {
      form: def.form,
      ipHash,
      now: new Date(),
      limit: formRateLimit(process.env),
    });
    if (limited) {
      log.warn("form.rate_limited", { form, ip: ipHash.slice(0, 12) });
      return { status: "error", code: "RATE_LIMITED" };
    }

    // 4. Turnstile, verified server-side.
    const data = parsed.data as z.output<S> & { turnstileToken: string };
    const turnstile = await verifyTurnstile(
      data.turnstileToken,
      def.turnstileAction,
    );
    if (!turnstile.ok) {
      return {
        status: "error",
        code:
          turnstile.reason === "unavailable"
            ? "TURNSTILE_UNAVAILABLE"
            : "TURNSTILE",
      };
    }

    // 5. Store (input is already sanitized by the schema).
    const { id } = await def.create(parsed.data as z.output<S>);
    log.info("form.submitted", { form, id });

    // 6. Notify (never throws; link only).
    await notifyNewSubmission({ kind: def.notifyKind, id });

    return { status: "success" };
  } catch (error) {
    log.error("form.error", { form, name: (error as Error)?.name });
    return { status: "error", code: "ERROR" };
  }
}
