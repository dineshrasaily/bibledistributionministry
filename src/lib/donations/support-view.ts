/**
 * What the Support page shows for a giving state. Pure module, so the
 * "wording driven by taxDeductibleVerified" rule is also tested at view level.
 */
import type { AppLocale } from "@/i18n/routing";
import { donationDisclosure } from "@/lib/donation-wording";
import type { GivingState } from "./giving-state";

/** How a monthly donor changes or cancels: Stripe's portal or by email. */
export type ManageMonthly = { kind: "portal"; url: string } | { kind: "email" };

export type SupportView =
  | { kind: "open"; taxNote: string; manageMonthly: ManageMonthly }
  | { kind: "not-configured" | "closed"; taxNote: null };

export type SupportSection =
  "stripe" | "offline" | "other-ways" | "unavailable";

/**
 * Order of the giving blocks on the Support page. Stripe (when open) comes
 * first; when it isn't open, Zelle/bank leads and the "not set up" card is
 * replaced by a softer "other ways" card. Neither: today's card, unchanged.
 */
export function supportSections(
  kind: SupportView["kind"],
  hasOffline: boolean,
): SupportSection[] {
  if (kind === "open") return hasOffline ? ["stripe", "offline"] : ["stripe"];
  return hasOffline ? ["offline", "other-ways"] : ["unavailable"];
}

export function manageMonthlyOf(portalUrl: string | null): ManageMonthly {
  return portalUrl ? { kind: "portal", url: portalUrl } : { kind: "email" };
}

export function supportViewModel({
  state,
  verified,
  portalUrl,
  locale,
}: {
  state: GivingState;
  verified: boolean;
  portalUrl: string | null;
  locale: AppLocale;
}): SupportView {
  // No form, no amounts, no tax wording unless giving is actually open.
  if (state !== "open") return { kind: state, taxNote: null };
  return {
    kind: "open",
    taxNote: donationDisclosure(locale, verified).taxNote,
    manageMonthly: manageMonthlyOf(portalUrl),
  };
}
