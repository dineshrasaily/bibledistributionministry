import { z } from "zod";
import { PASSWORDS_DIFFER_MSG, passwordSchema, REQUIRED_MSG } from "./common";

const confirm = <T extends { newPassword: string; confirmPassword: string }>(
  v: T,
) => v.newPassword === v.confirmPassword;

/** Phase A of changePasswordAction (section 11). */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: REQUIRED_MSG })
      .min(1, REQUIRED_MSG)
      .max(256, "Use at most 256 characters"),
    newPassword: passwordSchema,
    confirmPassword: z.string({ error: REQUIRED_MSG }),
  })
  .refine(confirm, {
    message: PASSWORDS_DIFFER_MSG,
    path: ["confirmPassword"],
  });

/** Phase B re-validates only the new password (actor id comes from the guard). */
export const newPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string({ error: REQUIRED_MSG }),
  })
  .refine(confirm, {
    message: PASSWORDS_DIFFER_MSG,
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export type NewPasswordInput = z.output<typeof newPasswordSchema>;
