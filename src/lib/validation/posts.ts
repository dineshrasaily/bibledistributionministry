import { z } from "zod";
import { ContentStatus, PostType } from "@/generated/prisma/enums";
import {
  checkbox,
  enumOf,
  idList,
  idSchema,
  intentSchema,
  markdownText,
  optionalDateTime,
  optionalMarkdown,
  optionalSafeUrl,
  optionalText,
  requiredText,
  slugSchema,
  stringList,
} from "./common";

/** Textarea split on newlines/commas, trimmed, empties dropped; max 10. */
export const scriptureRefsSchema = stringList
  .transform((values) =>
    values
      .flatMap((v) => v.split(/[\n,]/))
      .map((v) => v.trim())
      .filter((v) => v !== ""),
  )
  .pipe(
    z
      .array(z.string().max(60, "Use at most 60 characters per reference"))
      .max(10, "Add at most 10 references."),
  );

export const postFields = {
  type: enumOf(PostType),
  titleEn: requiredText(160),
  titleNe: optionalText(160),
  slug: slugSchema,
  excerptEn: requiredText(400),
  excerptNe: optionalText(400),
  bodyEn: markdownText(),
  bodyNe: optionalMarkdown(),
  scriptureRefs: scriptureRefsSchema,
  categoryIds: idList(20),
  coverImageUrl: optionalSafeUrl(),
  isFeatured: checkbox(),
  seoTitleEn: optionalText(70),
  seoTitleNe: optionalText(70),
  seoDescriptionEn: optionalText(160),
  seoDescriptionNe: optionalText(160),
  /** Empty on update keeps the stored value (review NIT 7). */
  publishedAt: optionalDateTime,
  intent: intentSchema,
};

export const postSchema = z.object(postFields);
export const updatePostSchema = z.object({ id: idSchema, ...postFields });
export const postStatusSchema = z.object({
  id: idSchema,
  status: enumOf(ContentStatus),
});

export type PostInput = z.output<typeof postSchema>;
export type UpdatePostInput = z.output<typeof updatePostSchema>;
export type PostStatusInput = z.output<typeof postStatusSchema>;
