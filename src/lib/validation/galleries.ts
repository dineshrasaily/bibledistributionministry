/**
 * Zod schemas for gallery admin actions. Pure module.
 */
import { z } from "zod";
import { ContentStatus } from "@/generated/prisma/enums";
import {
  enumOf,
  idList,
  idSchema,
  intentSchema,
  optionalText,
  requiredText,
} from "./common";

export const MAX_GALLERY_ITEMS = 200;

const optionalEventId = z
  .preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    idSchema.nullable(),
  )
  .transform((v) => v ?? null);

const galleryFields = {
  titleEn: requiredText(160),
  titleNe: optionalText(160),
  descriptionEn: optionalText(1000),
  descriptionNe: optionalText(1000),
  eventId: optionalEventId,
  intent: intentSchema,
};

export const gallerySchema = z.object(galleryFields);
export const updateGallerySchema = z.object({ ...galleryFields, id: idSchema });
export const galleryStatusSchema = z.object({
  id: idSchema,
  status: enumOf(ContentStatus),
});
export const galleryAddItemsSchema = z.object({
  galleryId: idSchema,
  mediaIds: idList(50).pipe(
    z.array(idSchema).min(1, "Choose at least one picture."),
  ),
});
export const galleryMoveSchema = z.object({
  galleryId: idSchema,
  mediaId: idSchema,
  direction: z.enum(["up", "down"], { error: "Choose up or down." }),
});
export const galleryRemoveItemSchema = z.object({
  galleryId: idSchema,
  mediaId: idSchema,
});

export type GalleryInput = z.output<typeof gallerySchema>;
export type UpdateGalleryInput = z.output<typeof updateGallerySchema>;
export type GalleryStatusInput = z.output<typeof galleryStatusSchema>;
export type GalleryAddItemsInput = z.output<typeof galleryAddItemsSchema>;
export type GalleryMoveInput = z.output<typeof galleryMoveSchema>;
export type GalleryRemoveItemInput = z.output<typeof galleryRemoveItemSchema>;
