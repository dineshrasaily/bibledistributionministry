/**
 * Public giving state. Pure module, used by BOTH the Support page and the
 * checkout action, so a hidden form cannot be bypassed by posting directly.
 *
 * Giving opens only when the webhook can record gifts too (secret key AND
 * webhook signing secret), so nobody is charged for a gift we can't record.
 */
export type GivingState = "not-configured" | "closed" | "open";
export function resolveGivingState({
  webhookReady,
  donationsEnabled,
}: {
  webhookReady: boolean;
  donationsEnabled: boolean;
}): GivingState {
  if (!webhookReady) return "not-configured";
  return donationsEnabled ? "open" : "closed";
}
