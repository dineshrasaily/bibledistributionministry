"use server";

import type { DonationFormState } from "@/lib/validation/donations";
import { runCheckoutStart } from "@/server/donations/checkout";

/**
 * Public "give" action: validates the amount server-side and redirects to
 * Stripe Checkout (no session needed; Next's server-action origin check
 * applies).
 */
export async function startCheckoutAction(
  _prev: DonationFormState | null,
  formData: FormData,
): Promise<DonationFormState> {
  return runCheckoutStart(formData);
}
