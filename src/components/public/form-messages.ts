"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { PublicFormErrorCode } from "@/lib/validation/public-forms";

/**
 * Translates the i18n error keys returned by the public form actions
 * ("required", "tooLong:4000", ...) and the form-level error codes.
 */
export function useFormErrorText() {
  const t = useTranslations("FormErrors");

  const field = useCallback(
    (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const [name, arg] = key.split(":");
      switch (name) {
        case "tooLong":
          return t("tooLong", { max: Number(arg) || 0 });
        case "required":
          return t("required");
        case "invalidEmail":
          return t("invalidEmail");
        case "invalidOption":
          return t("invalidOption");
        case "turnstileMissing":
          return t("turnstileMissing");
        default:
          return t("generic");
      }
    },
    [t],
  );

  const form = useCallback(
    (code: PublicFormErrorCode): string => {
      switch (code) {
        case "VALIDATION":
          return t("fixFields");
        case "RATE_LIMITED":
          return t("rateLimited");
        case "TURNSTILE":
          return t("turnstile");
        case "TURNSTILE_UNAVAILABLE":
          return t("turnstileUnavailable");
        default:
          return t("generic");
      }
    },
    [t],
  );

  return { field, form };
}
