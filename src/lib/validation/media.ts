import { z } from "zod";
import { ContentStatus, MediaCategory } from "@/generated/prisma/enums";
import {
  checkbox,
  enumOf,
  idSchema,
  intentSchema,
  optionalDateTime,
  optionalSafeUrl,
  optionalText,
  requiredText,
  safeUrl,
  youtubeUrl,
} from "./common";

const durationMinutes = z
  .preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    z.coerce
      .number({ error: "Enter whole minutes." })
      .int("Enter whole minutes.")
      .min(0, "Enter whole minutes.")
      .max(1440, "Use at most 1440 minutes.")
      .nullable(),
  )
  .transform((v) => v ?? null);

export const SORT_ORDER_MSG = "Enter a whole number from 0 to 9999.";

const sortOrder = z.preprocess(
  (v) => (v == null || (typeof v === "string" && v.trim() === "") ? 0 : v),
  z.coerce
    .number({ error: SORT_ORDER_MSG })
    .int(SORT_ORDER_MSG)
    .min(0, SORT_ORDER_MSG)
    .max(9999, SORT_ORDER_MSG),
);

/** Optional linked mission/event; blank means none. */
const eventId = z
  .preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    idSchema.nullable(),
  )
  .transform((v) => v ?? null);

const commonFields = {
  category: enumOf(MediaCategory),
  eventId,
  sortOrder,
  titleEn: requiredText(160),
  titleNe: optionalText(160),
  descriptionEn: optionalText(1000),
  descriptionNe: optionalText(1000),
  durationMinutes,
  thumbnailUrl: optionalSafeUrl(),
  /** Empty on update keeps the stored value; empty on create means now. */
  publishedAt: optionalDateTime,
  isFeatured: checkbox(),
  intent: intentSchema,
};

function mediaUnion<E extends z.ZodRawShape>(extra: E) {
  return z.discriminatedUnion(
    "type",
    [
      z.object({
        ...extra,
        ...commonFields,
        type: z.literal("IMAGE"),
        url: safeUrl(),
        altTextEn: requiredText(300),
        altTextNe: optionalText(300),
      }),
      z.object({
        ...extra,
        ...commonFields,
        type: z.literal("AUDIO"),
        url: safeUrl(),
      }),
      z.object({
        ...extra,
        ...commonFields,
        type: z.literal("VIDEO_EMBED"),
        embedUrl: youtubeUrl,
      }),
    ],
    { error: "Choose a valid media type." },
  );
}

export const mediaSchema = mediaUnion({});
export const updateMediaSchema = mediaUnion({ id: idSchema });
export const mediaStatusSchema = z.object({
  id: idSchema,
  status: enumOf(ContentStatus),
});

export type MediaInput = z.output<typeof mediaSchema>;
export type UpdateMediaInput = z.output<typeof updateMediaSchema>;
export type MediaStatusInput = z.output<typeof mediaStatusSchema>;
