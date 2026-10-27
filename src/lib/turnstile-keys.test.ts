import { describe, expect, it } from "vitest";
import {
  resolveTurnstileKeys,
  TURNSTILE_TEST_SECRET_KEY,
  TURNSTILE_TEST_SITE_KEY,
} from "./turnstile-keys";

const TEST = {
  siteKey: TURNSTILE_TEST_SITE_KEY,
  secretKey: TURNSTILE_TEST_SECRET_KEY,
  mode: "test",
};

describe("resolveTurnstileKeys", () => {
  it("uses Cloudflare's test pair without keys", () => {
    expect(resolveTurnstileKeys({})).toEqual(TEST);
    expect(
      resolveTurnstileKeys({
        TURNSTILE_SITE_KEY: " ",
        TURNSTILE_SECRET_KEY: "",
      }),
    ).toEqual(TEST);
  });

  it("uses the test pair when only one key is set", () => {
    expect(resolveTurnstileKeys({ TURNSTILE_SITE_KEY: "0xsite" })).toEqual(
      TEST,
    );
    expect(resolveTurnstileKeys({ TURNSTILE_SECRET_KEY: "0xsecret" })).toEqual(
      TEST,
    );
  });

  it("is live when both keys are set", () => {
    expect(
      resolveTurnstileKeys({
        TURNSTILE_SITE_KEY: "0xsite",
        TURNSTILE_SECRET_KEY: "0xsecret",
      }),
    ).toEqual({ siteKey: "0xsite", secretKey: "0xsecret", mode: "live" });
  });
});
