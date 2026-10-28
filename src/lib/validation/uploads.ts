/**
 * Zod schemas for registering uploaded files and the picker's library query.
 * Pure module.
 */
import { z } from "zod";
import { checkbox, idSchema, optionalText, requiredText } from "./common";

const blankToNull = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? null : v;

const DIMENSION_MSG = "Invalid picture size.";
/** Client-reported pixel size (layout only); blank means unknown. */
const dimension = z
  .preprocess(
    blankToNull,
    z.coerce
      .number({ error: DIMENSION_MSG })
      .int(DIMENSION_MSG)
      .min(1, DIMENSION_MSG)
      .max(10_000, DIMENSION_MSG)
      .nullable(),
  )
  .transform((v) => v ?? null);

const optionalId = z
  .preprocess(blankToNull, idSchema.nullable())
  .transform((v) => v ?? null);

const common = {
  /** Local storage key or Vercel Blob URL returned by the transfer step. */
  ref: z
    .string({ error: "The uploaded file is missing. Upload it again." })
    .trim()
    .min(1, "The uploaded file is missing. Upload it again.")
    .max(600, "The uploaded file is missing. Upload it again."),
  titleEn: requiredText(160),
  titleNe: optionalText(160),
  width: dimension,
  height: dimension,
  originalFilename: optionalText(200),
  galleryId: optionalId,
  publish: checkbox(),
};

export const registerUploadSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      ...common,
      kind: z.literal("IMAGE"),
      altTextEn: requiredText(300),
      altTextNe: optionalText(300),
    }),
    z.object({ ...common, kind: z.literal("AUDIO") }),
  ],
  { error: "Choose a picture or an audio file." },
);

export type RegisterUploadInput = z.output<typeof registerUploadSchema>;

/** GET /api/admin/media/library: lenient, invalid values fall back. */
export const libraryQuerySchema = z.object({
  kind: z.enum(["image", "audio"]).catch("image"),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type LibraryQuery = z.output<typeof libraryQuerySchema>;

/** The Vercel Blob client payload sent with a client upload. */
export const blobClientPayloadSchema = z.object({
  kind: z.enum(["IMAGE", "AUDIO"]),
});
