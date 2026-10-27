import "server-only";
import { resolveTurnstileKeys } from "./turnstile-keys";

export type FormServicesStatus = {
  turnstile: "live" | "test";
  email: "configured" | "not-configured";
};

/** Configuration status for the admin (never the values themselves). */
export function getFormServicesStatus(
  env: Record<string, string | undefined> = process.env,
): FormServicesStatus {
  return {
    turnstile: resolveTurnstileKeys(env).mode,
    email:
      env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim()
        ? "configured"
        : "not-configured",
  };
}
