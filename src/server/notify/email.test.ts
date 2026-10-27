// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site-settings", () => ({
  getSiteSettings: vi.fn(async () => ({ contactEmail: "owner@example.org" })),
}));

const { notifyNewSubmission, RESEND_URL } = await import("./email");

// Sample private data: none of it may ever reach a log line or an email.
const PRIVATE = [
  "Please pray for my sister's surgery",
  "Sita Rai",
  "sita@example.org",
  "My private subject",
];
const KEY = "re_test_key_never_logged";

let logs: string[];

beforeEach(() => {
  logs = [];
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logs.push(String(line));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectRedacted(text: string) {
  for (const value of [...PRIVATE, KEY]) expect(text).not.toContain(value);
}

describe("notifyNewSubmission", () => {
  it("without RESEND_API_KEY logs one redacted notice and sends nothing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await notifyNewSubmission(
      { kind: "prayer", id: "abc123" },
      { fetchImpl, env: {} },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toEqual({
      level: "info",
      event: "notify.email.skipped",
      kind: "prayer",
      id: "abc123",
      reason: "RESEND_API_KEY missing",
    });
    expectRedacted(logs.join("\n"));
  });

  it("with a key but no sender address it skips", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await notifyNewSubmission(
      { kind: "contact", id: "m1" },
      { fetchImpl, env: { RESEND_API_KEY: KEY } },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.parse(logs[0]!).reason).toBe("RESEND_FROM_EMAIL missing");
    expectRedacted(logs.join("\n"));
  });

  it("sends a link-only email through Resend", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    await notifyNewSubmission(
      { kind: "prayer", id: "abc123" },
      {
        fetchImpl,
        env: { RESEND_API_KEY: KEY, RESEND_FROM_EMAIL: "site@example.org" },
      },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(RESEND_URL);
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Bearer ${KEY}`,
    );
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      from: "site@example.org",
      to: ["owner@example.org"],
      subject: "New prayer request",
    });
    expect(body.text).toContain("/admin/inbox/prayer/abc123");
    expect(body.html).toContain("/admin/inbox/prayer/abc123");
    expect(Object.keys(body).sort()).toEqual([
      "from",
      "html",
      "subject",
      "text",
      "to",
    ]);
    expectRedacted(JSON.stringify(body));
    expectRedacted(logs.join("\n"));
  });

  it("uses CONTACT_TO_EMAIL and the messages link for contact messages", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 200 }),
    );
    await notifyNewSubmission(
      { kind: "contact", id: "m1" },
      {
        fetchImpl,
        env: {
          RESEND_API_KEY: KEY,
          RESEND_FROM_EMAIL: "site@example.org",
          CONTACT_TO_EMAIL: "inbox@example.org",
        },
      },
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.to).toEqual(["inbox@example.org"]);
    expect(body.subject).toBe("New contact message");
    expect(body.text).toContain("/admin/inbox/messages/m1");
  });

  it("logs only the status on a failed send (no key, no recipient)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("boom", { status: 500 }),
    );
    await notifyNewSubmission(
      { kind: "prayer", id: "abc123" },
      {
        fetchImpl,
        env: { RESEND_API_KEY: KEY, RESEND_FROM_EMAIL: "site@example.org" },
      },
    );
    expect(JSON.parse(logs[0]!)).toEqual({
      level: "warn",
      event: "notify.email.failed",
      kind: "prayer",
      id: "abc123",
      status: 500,
    });
    expect(logs.join("\n")).not.toContain("owner@example.org");
    expectRedacted(logs.join("\n"));
  });

  it("never throws when fetch fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network down");
    });
    await expect(
      notifyNewSubmission(
        { kind: "prayer", id: "abc123" },
        {
          fetchImpl,
          env: { RESEND_API_KEY: KEY, RESEND_FROM_EMAIL: "site@example.org" },
        },
      ),
    ).resolves.toBeUndefined();
    expect(JSON.parse(logs[0]!).event).toBe("notify.email.error");
    expectRedacted(logs.join("\n"));
  });
});
