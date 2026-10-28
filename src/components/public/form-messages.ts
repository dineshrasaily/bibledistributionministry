"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import type { AppLocale } from "@/i18n/routing";
import { formatPresetUsd } from "@/lib/donations/amount";
import type { DonationFormErrorCode } from "@/lib/validation/donations";
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

/** Donation form: amount keys ("amountTooSmall:5") and checkout codes. */
export function useDonationErrorText() {
  const t = useTranslations("FormErrors");
  const locale = useLocale() as AppLocale;
  const baseField = useFormErrorText().field;

  const field = useCallback(
    (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const [name, arg] = key.split(":");
      const usd = (value: string | undefined) =>
        formatPresetUsd(Number(value) || 0, locale);
      switch (name) {
        case "amountRequired":
          return t("amountRequired");
        case "amountInvalid":
          return t("amountInvalid");
        case "amountTooSmall":
          return t("amountTooSmall", { min: usd(arg) });
        case "amountTooLarge":
          return t("amountTooLarge", { max: usd(arg) });
        default:
          return baseField(key);
      }
    },
    [t, locale, baseField],
  );

  const form = useCallback(
    (code: DonationFormErrorCode): string => {
      switch (code) {
        case "VALIDATION":
          return t("fixFields");
        case "RATE_LIMITED":
          return t("donationRateLimited");
        case "NOT_AVAILABLE":
          return t("notAvailable");
        default:
          return t("donationGeneric");
      }
    },
    [t],
  );

  return { field, form };
}
