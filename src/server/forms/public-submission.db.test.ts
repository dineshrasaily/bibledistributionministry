import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile-keys";
import {
  submitContactAction,
  submitPrayerAction,
} from "@/server/actions/public-forms";
import { resetDb, testRequest } from "@/test/db-setup";
import { form } from "@/test/forms";
import {
  allAttemptRows,
  allMessageRows,
  allPrayerRows,
  backdateAttempts,
} from "@/test/inbox-rows";
import { SITEVERIFY_URL } from "./turnstile";

const IP = "203.0.113.7";
const SECRET_BODY = "Please pray for my sister's private surgery";
const NAME = "Sita Rai";
const EMAIL = "sita@example.org";

let logs: string[];
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(async () => {
  await resetDb();
  testRequest.headers.set("x-forwarded-for", IP);
  logs = [];
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
  }
  // Any real network call fails the test.
  fetchMock = vi.fn<typeof fetch>(async (input) => {
    throw new Error(`unexpected network call to ${String(input)}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TURNSTILE_SITE_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("FORM_RATE_LIMIT_PER_HOUR", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const prayerForm = (fields: Record<string, string> = {}) =>
  form({
    locale: "en",
    name: NAME,
    email: EMAIL,
    body: SECRET_BODY,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
    website: "",
    ...fields,
  });

const contactForm = (fields: Record<string, string> = {}) =>
  form({
    locale: "en",
    name: NAME,
    email: EMAIL,
    kind: "GENERAL",
    subject: "A private subject",
    message: SECRET_BODY,
    turnstileToken: TURNSTILE_DUMMY_TOKEN,
    website: "",
    ...fields,
  });

describe("prayer form submissions", () => {
  it("stores a normal request, private and sanitized, with consent off", async () => {
    expect(
      await submitPrayerAction(
        null,
        prayerForm({ body: `${SECRET_BODY}\u202E\r\n\r\n\r\n\r\nAmen` }),
      ),
    ).toEqual({ status: "success" });
    const rows = await allPrayerRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: NAME,
      email: EMAIL,
      isAnonymous: false,
      body: `${SECRET_BODY}\n\nAmen`,
      shareConsent: false,
      status: "NEW",
      locale: "en",
    });
  });

  it("anonymous: name and email are cleared server-side, even an invalid email", async () => {
    expect(
      await submitPrayerAction(
        null,
        prayerForm({ isAnonymous: "on", email: "not-an-email", locale: "ne" }),
      ),
    ).toEqual({ status: "success" });
    const [row] = await allPrayerRows();
    expect(row).toMatchObject({
      name: null,
      email: null,
      isAnonymous: true,
      locale: "ne",
    });
    expect(JSON.stringify(row)).not.toContain(NAME);
  });

  it("keeps sharing consent only when ticked", async () => {
    await submitPrayerAction(null, prayerForm({ shareConsent: "on" }));
    expect((await allPrayerRows())[0]!.shareConsent).toBe(true);
  });

  it("honeypot: reports success but stores nothing", async () => {
    expect(
      await submitPrayerAction(
        null,
        prayerForm({ website: "https://spam.example" }),
      ),
    ).toEqual({ status: "success" });
    expect(await allPrayerRows()).toHaveLength(0);
    expect(await allAttemptRows()).toHaveLength(0);
  });

  it("validation errors store nothing and use i18n keys", async () => {
    expect(
      await submitPrayerAction(null, prayerForm({ body: " ", email: "x" })),
    ).toEqual({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { body: "required", email: "invalidEmail" },
    });
    expect(await allPrayerRows()).toHaveLength(0);
    expect(await allAttemptRows()).toHaveLength(0);
  });

  it("rate limit: 5 per hour per hashed IP; the raw IP is never stored", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await submitPrayerAction(null, prayerForm())).toEqual({
        status: "success",
      });
    }
    expect(await submitPrayerAction(null, prayerForm())).toEqual({
      status: "error",
      code: "RATE_LIMITED",
    });
    expect(await allPrayerRows()).toHaveLength(5);

    // The contact form has its own budget.
    expect(await submitContactAction(null, contactForm())).toEqual({
      status: "success",
    });

    // Another IP is not affected.
    testRequest.headers.set("x-forwarded-for", "198.51.100.20");
    expect(await submitPrayerAction(null, prayerForm())).toEqual({
      status: "success",
    });

    const attempts = await allAttemptRows();
    expect(attempts.length).toBe(8);
    for (const a of attempts) expect(a.ipHash).toMatch(/^[0-9a-f]{64}$/);
    const dump = JSON.stringify(attempts) + logs.join("\n");
    expect(dump).not.toContain(IP);
    expect(dump).not.toContain("198.51.100.20");
  });

  it("after an hour the budget is back; attempt rows older than 24h are deleted", async () => {
    for (let i = 0; i < 5; i++) await submitPrayerAction(null, prayerForm());
    await backdateAttempts(61 * 60 * 1000);
    expect(await submitPrayerAction(null, prayerForm())).toEqual({
      status: "success",
    });
    expect(await allAttemptRows()).toHaveLength(6);

    await backdateAttempts(25 * 60 * 60 * 1000);
    await submitPrayerAction(null, prayerForm());
    expect(await allAttemptRows()).toHaveLength(1);
  });

  it("honours FORM_RATE_LIMIT_PER_HOUR", async () => {
    vi.stubEnv("FORM_RATE_LIMIT_PER_HOUR", "2");
    await submitPrayerAction(null, prayerForm());
    await submitPrayerAction(null, prayerForm());
    expect(await submitPrayerAction(null, prayerForm())).toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("Turnstile: a wrong token is rejected and nothing is stored", async () => {
    expect(
      await submitPrayerAction(null, prayerForm({ turnstileToken: "forged" })),
    ).toEqual({ status: "error", code: "TURNSTILE" });
    expect(
      await submitPrayerAction(null, prayerForm({ turnstileToken: "" })),
    ).toEqual({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { turnstileToken: "turnstileMissing" },
    });
    expect(await allPrayerRows()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Turnstile with live keys: verified via siteverify (mocked fetch)", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "0xLIVE-SITE");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "0xLIVE-SECRET");
    fetchMock.mockImplementation(async (input) => {
      expect(String(input)).toBe(SITEVERIFY_URL);
      return new Response(JSON.stringify({ success: true, action: "prayer" }));
    });
    expect(
      await submitPrayerAction(
        null,
        prayerForm({ turnstileToken: "live-tok" }),
      ),
    ).toEqual({ status: "success" });
    expect(await allPrayerRows()).toHaveLength(1);

    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    expect(
      await submitPrayerAction(
        null,
        prayerForm({ turnstileToken: "live-tok" }),
      ),
    ).toEqual({ status: "error", code: "TURNSTILE_UNAVAILABLE" });
    expect(await allPrayerRows()).toHaveLength(1);
  });

  it("logs never contain the body, name, email or raw IP", async () => {
    await submitPrayerAction(null, prayerForm());
    await submitPrayerAction(null, prayerForm({ body: "" }));
    await submitPrayerAction(null, prayerForm({ website: "spam" }));
    const all = logs.join("\n");
    expect(all).toContain("notify.email.skipped");
    for (const secret of [SECRET_BODY, NAME, EMAIL, IP]) {
      expect(all).not.toContain(secret);
    }
  });
});

describe("contact form submissions", () => {
  it("GENERAL: consent is never stored even if the box was sent", async () => {
    expect(
      await submitContactAction(null, contactForm({ shareConsent: "on" })),
    ).toEqual({ status: "success" });
    const [row] = await allMessageRows();
    expect(row).toMatchObject({
      name: NAME,
      email: EMAIL,
      kind: "GENERAL",
      subject: "A private subject",
      body: SECRET_BODY,
      shareConsent: false,
      status: "NEW",
    });
  });

  it("TESTIMONY keeps the consent box", async () => {
    await submitContactAction(
      null,
      contactForm({ kind: "TESTIMONY", shareConsent: "on", locale: "ne" }),
    );
    expect((await allMessageRows())[0]).toMatchObject({
      kind: "TESTIMONY",
      shareConsent: true,
      locale: "ne",
    });
  });

  it("validation and honeypot store nothing", async () => {
    expect(
      await submitContactAction(null, contactForm({ kind: "SPAM", email: "" })),
    ).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { kind: "invalidOption", email: "required" },
    });
    await submitContactAction(null, contactForm({ website: "x" }));
    expect(await allMessageRows()).toHaveLength(0);
  });

  it("sends a link-only notification when Resend is configured (mocked)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_placeholder");
    vi.stubEnv("RESEND_FROM_EMAIL", "site@example.org");
    fetchMock.mockImplementation(
      async () => new Response("{}", { status: 200 }),
    );
    await submitContactAction(null, contactForm());
    const [row] = await allMessageRows();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0]![1]?.body);
    expect(body).toContain(`/admin/inbox/messages/${row!.id}`);
    for (const secret of [SECRET_BODY, NAME, EMAIL, "A private subject"]) {
      expect(body).not.toContain(secret);
    }
  });
});
