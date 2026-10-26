import { z } from "zod";
import { emailSchema, REQUIRED_MSG } from "./common";

export const loginStep1Schema = z.object({
  email: emailSchema,
  password: z
    .string({ error: REQUIRED_MSG })
    .min(1, REQUIRED_MSG)
    .max(256, "Use at most 256 characters"),
});

export const TOTP_CODE_MSG =
  "Enter the 6-digit code from your authenticator app.";

/** 6 digits after removing spaces ("123 456" is accepted). */
export const totpCodeSchema = z
  .string({ error: TOTP_CODE_MSG })
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, TOTP_CODE_MSG));

export const loginStep2Schema = z.object({ code: totpCodeSchema });

export type LoginStep1Input = z.output<typeof loginStep1Schema>;
