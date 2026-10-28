/**
 * Donation checkout input and admin donation list filters. Pure module.
 *
 * Checkout error messages are i18n KEYS of the `FormErrors` namespace
 * ("amountRequired", "amountTooSmall:5", ...), as in the Phase 6 forms.
 * The amount is decided here, on the server; the form only sends a choice.
 */
import { z } from "zod";
import { DonationInterval, DonationStatus } from "@/generated/prisma/enums";
import {
  DONATION_PRESETS_USD,
  MAX_CENTS,
  MAX_USD,
  MIN_CENTS,
  MIN_USD,
  parseUsdToCents,
} from "@/lib/donations/amount";
import { DONATION_PERIODS, type DonationPeriod } from "@/lib/donations/period";
import { parseListQuery, type ListQuery } from "./list-query";

export const CUSTOM_AMOUNT = "custom";
const PRESET_CHOICES = DONATION_PRESETS_USD.map(String);

const choiceSchema = z
  .string({ error: "amountRequired" })
  .refine((v) => v === CUSTOM_AMOUNT || PRESET_CHOICES.includes(v), {
    message: "amountRequired",
  });

export const checkoutSchema = z
  .object({
    locale: z.enum(["en", "ne"]).catch("en"),
    interval: z.enum(DonationInterval, { error: "invalidOption" }),
    amountChoice: choiceSchema,
    customAmount: z.string().max(32).optional(),
  })
  .transform((input, ctx) => {
    let cents: number | null;
    if (input.amountChoice === CUSTOM_AMOUNT) {
      const raw = input.customAmount?.trim() ?? "";
      if (raw === "") {
        ctx.addIssue({
          code: "custom",
          message: "amountRequired",
          path: ["customAmount"],
        });
        return z.NEVER;
      }
      cents = parseUsdToCents(raw);
      if (cents === null) {
        ctx.addIssue({
          code: "custom",
          message: "amountInvalid",
          path: ["customAmount"],
        });
        return z.NEVER;
      }
    } else {
      cents = Number(input.amountChoice) * 100;
    }
    const path = [
      input.amountChoice === CUSTOM_AMOUNT ? "customAmount" : "amountChoice",
    ];
    if (cents < MIN_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: `amountTooSmall:${MIN_USD}`,
        path,
      });
      return z.NEVER;
    }
    if (cents > MAX_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: `amountTooLarge:${MAX_USD}`,
        path,
      });
      return z.NEVER;
    }
    return {
      locale: input.locale,
      interval: input.interval,
      amountCents: cents,
    };
  });

export type CheckoutRequest = z.output<typeof checkoutSchema>;

export type DonationFormErrorCode =
  "VALIDATION" | "RATE_LIMITED" | "NOT_AVAILABLE" | "ERROR";

export type DonationFormState =
  | { status: "idle" }
  | {
      status: "error";
      code: DonationFormErrorCode;
      fieldErrors?: Record<string, string>;
    };

// ---------- admin list filters (lenient, like every admin list) ----------

const PERIOD_VALUES = Object.fromEntries(
  DONATION_PERIODS.map((p) => [p, p]),
) as Record<DonationPeriod, DonationPeriod>;

export const DONATION_MODES = { live: "live", test: "test" } as const;

export const DONATION_FILTERS = {
  period: PERIOD_VALUES,
  interval: DonationInterval,
  status: DonationStatus,
  mode: DONATION_MODES,
};

export type DonationListQuery = Omit<
  ListQuery<typeof DONATION_FILTERS>,
  "period"
> & { period: DonationPeriod };

export const DEFAULT_DONATION_PERIOD: DonationPeriod = "this-month";

export function parseDonationListQuery(
  searchParams: Record<string, string | string[] | undefined>,
): DonationListQuery {
  const query = parseListQuery(searchParams, DONATION_FILTERS);
  return { ...query, period: query.period ?? DEFAULT_DONATION_PERIOD };
}
