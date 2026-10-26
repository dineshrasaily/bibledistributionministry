import { z } from "zod";
import { idSchema, optionalText, requiredText, slugSchema } from "./common";

export const categoryFields = {
  nameEn: requiredText(60),
  nameNe: optionalText(60),
  slug: slugSchema,
};

export const categorySchema = z.object(categoryFields);
export const updateCategorySchema = z.object({
  id: idSchema,
  ...categoryFields,
});

export type CategoryInput = z.output<typeof categorySchema>;
export type UpdateCategoryInput = z.output<typeof updateCategorySchema>;
