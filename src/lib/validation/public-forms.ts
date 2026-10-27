/**
 * Zod schemas for the public prayer and contact forms. Pure module.
 *
 * Error messages are i18n KEYS of the `FormErrors` namespace ("required",
 * "invalidEmail", "tooLong:<max>", ...), translated by the client form.
 * Text is sanitized before the length limits are checked.
 */
import { z } from "zod";
import { MessageKind } from "@/generated/prisma/enums";
import { sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize-text";
import { checkbox } from "./common";

export const PRAYER_LIMITS = { name: 100, email: 254, body: 4000 } as const;
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 150,
  message: 5000,
} as const;
export const TURNSTILE_TOKEN_MAX = 2048;

export const tooLongKey = (max: number) => `tooLong:${max}`;

const blankToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

function requiredPublicText(max: number, singleLine = false) {
  const clean = singleLine ? sanitizeSingleLine : sanitizePlainText;
  return z
    .string({ error: "required" })
    .transform(clean)
    .pipe(z.string().min(1, "required").max(max, tooLongKey(max)));
}

function optionalPublicText(max: number) {
  return z
    .preprocess(
      blankToUndefined,
      z
        .string()
        .transform(sanitizeSingleLine)
        .pipe(z.string().max(max, tooLongKey(max)))
        .optional(),
    )
    .transform((v) => (v ? v : null));
}

const publicEmail = z
  .string({ error: "required" })
  .trim()
  .min(1, "required")
  .toLowerCase()
  .pipe(
    z
      .email("invalidEmail")
      .max(CONTACT_LIMITS.email, tooLongKey(CONTACT_LIMITS.email)),
  );

const optionalPublicEmail = z
  .preprocess(blankToUndefined, publicEmail.optional())
  .transform((v) => v ?? null);

const localeSchema = z.enum(["en", "ne"]).catch("en");

const turnstileToken = z
  .string({ error: "turnstileMissing" })
  .trim()
  .min(1, "turnstileMissing")
  .max(TURNSTILE_TOKEN_MAX, "turnstileMissing");

/** Anonymous submissions drop name/email BEFORE validation. */
function dropIdentityWhenAnonymous(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const anonymous =
    obj.isAnonymous === "on" ||
    obj.isAnonymous === "true" ||
    obj.isAnonymous === true;
  if (!anonymous) return obj;
  const rest = { ...obj };
  delete rest.name;
  delete rest.email;
  return rest;
}

export const prayerSubmissionSchema = z.preprocess(
  dropIdentityWhenAnonymous,
  z
    .object({
      locale: localeSchema,
      isAnonymous: checkbox(),
      name: optionalPublicText(PRAYER_LIMITS.name),
      email: optionalPublicEmail,
      body: requiredPublicText(PRAYER_LIMITS.body),
      shareConsent: checkbox(),
      turnstileToken,
    })
    .transform((v) => (v.isAnonymous ? { ...v, name: null, email: null } : v)),
);

export const contactSubmissionSchema = z
  .object({
    locale: localeSchema,
    name: requiredPublicText(CONTACT_LIMITS.name, true),
    email: publicEmail,
    kind: z.enum(MessageKind, { error: "invalidOption" }),
    subject: requiredPublicText(CONTACT_LIMITS.subject, true),
    message: requiredPublicText(CONTACT_LIMITS.message),
    shareConsent: checkbox(),
    turnstileToken,
  })
  // Consent only means something for testimonies.
  .transform((v) => ({
    ...v,
    shareConsent: v.kind === "TESTIMONY" && v.shareConsent,
  }));

export type PrayerSubmission = z.output<typeof prayerSubmissionSchema>;
export type ContactSubmission = z.output<typeof contactSubmissionSchema>;

export type PublicFormErrorCode =
  | "VALIDATION"
  | "RATE_LIMITED"
  | "TURNSTILE"
  | "TURNSTILE_UNAVAILABLE"
  | "ERROR";

export type PublicFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      code: PublicFormErrorCode;
      fieldErrors?: Record<string, string>;
    };

export const DEFAULT_FORM_RATE_LIMIT = 5;

/** FORM_RATE_LIMIT_PER_HOUR: integer 1..1000, anything else -> 5. */
export function formRateLimit(env: Record<string, string | undefined>): number {
  const raw = env.FORM_RATE_LIMIT_PER_HOUR?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_FORM_RATE_LIMIT;
  const n = Number(raw);
  return n >= 1 && n <= 1000 ? n : DEFAULT_FORM_RATE_LIMIT;
}
