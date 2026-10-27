import { z } from "zod";
import { MessageStatus, PrayerStatus } from "@/generated/prisma/enums";
import { RETENTION_MAX, RETENTION_MIN } from "@/lib/retention";
import { sanitizePlainText } from "@/lib/sanitize-text";
import { checkbox, enumOf, idSchema } from "./common";

export const prayerStatusSchema = z.object({
  id: idSchema,
  status: enumOf(PrayerStatus),
});

export const messageStatusSchema = z.object({
  id: idSchema,
  status: enumOf(MessageStatus),
});

export type PrayerStatusInput = z.output<typeof prayerStatusSchema>;
export type MessageStatusInput = z.output<typeof messageStatusSchema>;

export const NOTE_MAX = 2000;
export const PUBLIC_TEXT_MAX = 1500;

/** Optional sanitized multi-line text; blank -> null. */
function optionalPlain(max: number) {
  return z
    .string()
    .nullish()
    .transform((v) => (v == null ? "" : sanitizePlainText(v)))
    .pipe(z.string().max(max, `Use at most ${max} characters`))
    .transform((v) => (v === "" ? null : v));
}

/** Private admin note on a prayer request or message. */
export const inboxNoteSchema = z.object({
  id: idSchema,
  adminNote: optionalPlain(NOTE_MAX),
});
export type InboxNoteInput = z.output<typeof inboxNoteSchema>;

export const NO_CONSENT_MSG =
  "This person did not agree to public sharing, so it can't be published.";
export const NOT_TESTIMONY_MSG =
  "Only testimonies can be published, and only with the sender's consent.";

export const PUBLIC_TEXT_REQUIRED_MSG =
  "Write the public version in English, Nepali or both.";
export const CONFIRM_NO_PII_MSG =
  "Confirm that you removed names, contact details and anything that identifies the person.";

/** Admin-edited public version of a consented prayer or testimony. */
export const publishShareSchema = z
  .object({
    id: idSchema,
    textEn: optionalPlain(PUBLIC_TEXT_MAX),
    textNe: optionalPlain(PUBLIC_TEXT_MAX),
    confirmNoPersonalInfo: checkbox(),
  })
  .superRefine((v, ctx) => {
    if (!v.textEn && !v.textNe) {
      ctx.addIssue({
        code: "custom",
        path: ["textEn"],
        message: PUBLIC_TEXT_REQUIRED_MSG,
      });
    }
    if (!v.confirmNoPersonalInfo) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmNoPersonalInfo"],
        message: CONFIRM_NO_PII_MSG,
      });
    }
  });
export type PublishShareInput = z.output<typeof publishShareSchema>;

const RETENTION_MSG = `Enter a whole number of months from ${RETENTION_MIN} to ${RETENTION_MAX}.`;

export const retentionSchema = z.object({
  inboxRetentionMonths: z.coerce
    .number({ error: RETENTION_MSG })
    .int(RETENTION_MSG)
    .min(RETENTION_MIN, RETENTION_MSG)
    .max(RETENTION_MAX, RETENTION_MSG),
});
export type RetentionInput = z.output<typeof retentionSchema>;

export const purgeSchema = z.object({
  confirm: z.literal("purge", { error: "Confirm the purge." }),
});
export type PurgeInput = z.output<typeof purgeSchema>;
