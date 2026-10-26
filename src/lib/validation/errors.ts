import { z } from "zod";

/** First message per top-level field (keys match form field names). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(flat)) {
    if (messages?.[0]) out[field] = messages[0];
  }
  return out;
}
