import { z } from "zod";
import { BibleTranslation, ContentStatus } from "@/generated/prisma/enums";
import {
  dateOnly,
  enumOf,
  idSchema,
  intentSchema,
  optionalDateOnly,
  requiredText,
} from "./common";

export const verseFields = {
  reference: requiredText(60),
  text: requiredText(2000),
  translation: enumOf(BibleTranslation),
  featuredOn: optionalDateOnly,
  intent: intentSchema,
};

export const verseSchema = z.object(verseFields);
export const updateVerseSchema = z.object({ id: idSchema, ...verseFields });
export const verseStatusSchema = z.object({
  id: idSchema,
  status: enumOf(ContentStatus),
});
/** "Feature on…" dialog: a verse id and a UTC date. */
export const featureVerseSchema = z.object({ id: idSchema, date: dateOnly });

export type VerseInput = z.output<typeof verseSchema>;
export type UpdateVerseInput = z.output<typeof updateVerseSchema>;
export type VerseStatusInput = z.output<typeof verseStatusSchema>;
export type FeatureVerseInput = z.output<typeof featureVerseSchema>;
