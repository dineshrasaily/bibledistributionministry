// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile-keys";
import { SITEVERIFY_URL, verifyTurnstile } from "./turnstile";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("verifyTurnstile with the test keys (no keys configured)", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  });

  it("accepts exactly the dummy token, offline", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(
      await verifyTurnstile(TURNSTILE_DUMMY_TOKEN, "prayer", { fetchImpl }),
    ).toEqual({ ok: true });
    expect(
      await verifyTurnstile("something-else", "prayer", { fetchImpl }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("verifyTurnstile with live keys", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "0xLIVE-SITE");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "0xLIVE-SECRET");
  });

  it("posts a urlencoded body without remoteip and passes on success + action", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ success: true, action: "prayer" }),
    );
    expect(await verifyTurnstile("tok-123", "prayer", { fetchImpl })).toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY_URL);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const params = new URLSearchParams(String(init?.body));
    expect(params.get("secret")).toBe("0xLIVE-SECRET");
    expect(params.get("response")).toBe("tok-123");
    expect(params.get("idempotency_key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(params.has("remoteip")).toBe(false);
  });

  it("fails when Cloudflare says success: false", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    );
    expect(await verifyTurnstile("tok", "prayer", { fetchImpl })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("fails when the action does not match the form", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ success: true, action: "contact" }),
    );
    expect(await verifyTurnstile("tok", "prayer", { fetchImpl })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("fails closed when the network call fails or returns non-JSON", async () => {
    const rejecting = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      await verifyTurnstile("tok", "prayer", { fetchImpl: rejecting }),
    ).toEqual({ ok: false, reason: "unavailable" });

    const html = vi.fn<typeof fetch>(
      async () => new Response("<html>oops</html>", { status: 502 }),
    );
    expect(await verifyTurnstile("tok", "prayer", { fetchImpl: html })).toEqual(
      { ok: false, reason: "unavailable" },
    );
  });

  it("does not accept the dummy token with live keys", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ success: false }),
    );
    expect(
      await verifyTurnstile(TURNSTILE_DUMMY_TOKEN, "prayer", { fetchImpl }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
