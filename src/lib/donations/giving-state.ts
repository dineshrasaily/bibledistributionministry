/**
 * Public giving state. Pure module, used by BOTH the Support page and the
 * checkout action, so a hidden form cannot be bypassed by posting directly.
 */
export type GivingState = "not-configured" | "closed" | "open";

export function resolveGivingState({
  checkoutReady,
  donationsEnabled,
}: {
  checkoutReady: boolean;
  donationsEnabled: boolean;
}): GivingState {
  if (!checkoutReady) return "not-configured";
  return donationsEnabled ? "open" : "closed";
}
