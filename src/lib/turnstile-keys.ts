/**
 * Cloudflare Turnstile key resolution. Pure module.
 *
 * Without real keys the site uses Cloudflare's official always-pass test
 * pair (https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
 * The test widget always returns the documented dummy token.
 */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export type TurnstileKeys = {
  siteKey: string;
  secretKey: string;
  mode: "live" | "test";
};

/** Live only when BOTH keys are set; otherwise the test pair. */
export function resolveTurnstileKeys(
  env: Record<string, string | undefined>,
): TurnstileKeys {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (siteKey && secretKey) return { siteKey, secretKey, mode: "live" };
  return {
    siteKey: TURNSTILE_TEST_SITE_KEY,
    secretKey: TURNSTILE_TEST_SECRET_KEY,
    mode: "test",
  };
}
