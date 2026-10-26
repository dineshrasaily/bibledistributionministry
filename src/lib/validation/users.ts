import { z } from "zod";
import {
  emailSchema,
  idSchema,
  PASSWORD_IS_EMAIL_MSG,
  PASSWORDS_DIFFER_MSG,
  passwordSchema,
  REQUIRED_MSG,
  requiredText,
} from "./common";

/** Used by the Users page and by the owner CLI (with confirmPassword = password). */
export const createEditorSchema = z
  .object({
    name: requiredText(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: REQUIRED_MSG }),
  })
  .refine((v) => String(v.password).toLowerCase() !== v.email, {
    message: PASSWORD_IS_EMAIL_MSG,
    path: ["password"],
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: PASSWORDS_DIFFER_MSG,
    path: ["confirmPassword"],
  });

export const setUserActiveSchema = z.object({
  id: idSchema,
  active: z
    .enum(["true", "false"], { error: "Choose a valid option." })
    .transform((v) => v === "true"),
});

/** Owner sets a temporary password for an editor. */
export const setEditorPasswordSchema = z
  .object({
    id: idSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: REQUIRED_MSG }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: PASSWORDS_DIFFER_MSG,
    path: ["confirmPassword"],
  });

export type CreateEditorInput = z.output<typeof createEditorSchema>;
export type SetUserActiveInput = z.output<typeof setUserActiveSchema>;
export type SetEditorPasswordInput = z.output<typeof setEditorPasswordSchema>;
