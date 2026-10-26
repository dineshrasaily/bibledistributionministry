import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { completeLoginAction, startLoginAction } from "@/server/actions/auth";
import { NavigationSignal, resetDb, testRequest } from "@/test/db-setup";
import { makeEditor, makeOwner, type TestAdmin } from "@/test/factories";
import {
  beginLogin,
  CHALLENGE_COOKIE,
  completeLogin,
  EXPIRED_MSG,
  GENERIC_MSG,
  INVALID_CODE_MSG,
  InvalidLoginError,
  RATE_LIMITED_MSG,
} from "./login";
import { getDummyHash, verifyPassword } from "./password";
import { open } from "./secret-box";
import { generateTotp } from "./totp";

vi.mock("@/server/auth/password", async (importOriginal) => {
  const m = await importOriginal<typeof import("./password")>();
  return { ...m, verifyPassword: vi.fn(m.verifyPassword) };
});

const verifySpy = vi.mocked(verifyPassword);

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const realHashCalls = (user: TestAdmin) =>
  verifySpy.mock.calls.filter(([hash]) => hash === user.passwordHash).length;

async function expectRedirect(promise: Promise<unknown>, location: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(NavigationSignal);
  expect((error as NavigationSignal).location).toBe(location);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (e: unknown) => e,
  );
}

beforeEach(async () => {
  await resetDb();
  await getDummyHash();
  verifySpy.mockClear();
  testRequest.headers.set("x-forwarded-for", "203.0.113.7");
});

describe("login: success paths", () => {
  it("VERIFY: password then code signs in, resets counters and audits", async () => {
    const owner = await makeOwner({ failedLoginCount: 2 });
    const step1 = await startLoginAction(
      null,
      form({ email: owner.email.toUpperCase(), password: owner.password }),
    );
    expect(step1).toMatchObject({ ok: true, step: "verify" });
    expect(testRequest.cookies.get(CHALLENGE_COOKIE)).toBeTruthy();
    expect(await prisma.loginChallenge.count()).toBe(1);

    const code = await generateTotp(owner.totpSecret);
    await expectRedirect(
      completeLoginAction(
        null,
        form({ code, step: "verify", next: "/admin/posts" }),
      ),
      "/admin/posts",
    );
    expect(testRequest.cookies.has(CHALLENGE_COOKIE)).toBe(false);
    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
    expect(after.lastLoginAt).not.toBeNull();
    expect(after.lastTotpStep).not.toBeNull();
    expect(
      await prisma.auditLog.count({ where: { action: "auth.login.success" } }),
    ).toBe(1);
  });

  it("ENROLL: first login enables TOTP with the pending secret", async () => {
    const editor = await makeEditor({ totp: false });
    const step1 = await startLoginAction(
      null,
      form({ email: editor.email, password: editor.password }),
    );
    expect(step1.ok).toBe(true);
    expect(step1.step).toBe("enroll");
    const secret = step1.enrollment!.secret;
    expect(step1.enrollment!.otpauthUri).toContain(`secret=${secret}`);
    expect(step1.enrollment!.qrSvg).toContain("<svg");

    await expectRedirect(
      completeLoginAction(
        null,
        form({ code: await generateTotp(secret), step: "enroll" }),
      ),
      "/admin",
    );
    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { id: editor.id },
    });
    expect(after.totpEnabled).toBe(true);
    expect(open(after.totpSecretEnc!, `totp:${editor.id}`)).toBe(secret);
    expect(
      await prisma.auditLog.count({ where: { action: "auth.totp.enrolled" } }),
    ).toBe(1);
  });
});

describe("login: failures", () => {
  it("AC17: identical message for unknown, wrong password, inactive and locked", async () => {
    const active = await makeOwner();
    const inactive = await makeEditor({ isActive: false });
    const locked = await makeEditor({
      lockedUntil: new Date(Date.now() + 600_000),
    });
    const attempts = [
      { email: "nobody@example.org", password: "whatever password" },
      { email: active.email, password: "wrong password!!" },
      { email: inactive.email, password: inactive.password },
      { email: locked.email, password: locked.password },
    ];
    const messages = [];
    for (const attempt of attempts) {
      const result = await startLoginAction(null, form(attempt));
      expect(result.ok).toBe(false);
      messages.push(result.formError);
    }
    expect(new Set(messages)).toEqual(new Set([GENERIC_MSG]));
  });

  it("validation errors do no DB work", async () => {
    const result = await startLoginAction(
      null,
      form({ email: "not-an-email", password: "" }),
    );
    expect(result.fieldErrors).toHaveProperty("email");
    expect(result.fieldErrors).toHaveProperty("password");
    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  it("AC18: 5 failures (password and TOTP) lock for 15 minutes; lock expires", async () => {
    const owner = await makeOwner();
    const now = new Date();
    const ip = "198.51.100.1";
    for (let i = 0; i < 4; i += 1) {
      const r = await beginLogin(
        { email: owner.email, password: "wrong password!!" },
        { ip, now },
      );
      expect(r.ok).toBe(false);
    }
    // Correct password (refunded), then a wrong TOTP code: 5th failure.
    const ok = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!ok.ok) throw new Error("expected step 1 to pass");
    const wrongCode =
      (await generateTotp(owner.totpSecret, now)) === "000000"
        ? "111111"
        : "000000";
    const err = await rejection(
      completeLogin({ challengeToken: ok.token, code: wrongCode }, { ip, now }),
    );
    expect(err).toBeInstanceOf(InvalidLoginError);
    expect((err as InvalidLoginError).code).toBe("challenge_expired");

    const lockedRow = await prisma.adminUser.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(lockedRow.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60_000);
    expect(lockedRow.failedLoginCount).toBe(0);

    verifySpy.mockClear();
    const duringLock = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now: new Date(now.getTime() + 14 * 60_000) },
    );
    expect(duringLock).toMatchObject({ ok: false, formError: GENERIC_MSG });
    expect(realHashCalls(owner)).toBe(0);

    const afterLock = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now: new Date(now.getTime() + 16 * 60_000) },
    );
    expect(afterLock.ok).toBe(true);
  });

  it("a correct password refunds its reservation and keeps earlier failures", async () => {
    const owner = await makeOwner();
    const ip = "198.51.100.2";
    for (let i = 0; i < 2; i += 1) {
      await beginLogin(
        { email: owner.email, password: "wrong pass!!" },
        { ip },
      );
    }
    const r = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip },
    );
    expect(r.ok).toBe(true);
    const row = await prisma.adminUser.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(row.failedLoginCount).toBe(2);
  });

  it("self-heals a counter left at 7 without a lock", async () => {
    const owner = await makeOwner({ failedLoginCount: 7 });
    const r = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip: "198.51.100.3" },
    );
    expect(r).toMatchObject({ ok: false, formError: GENERIC_MSG });
    expect(realHashCalls(owner)).toBe(0);
    const row = await prisma.adminUser.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(row.lockedUntil).not.toBeNull();
    expect(row.failedLoginCount).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { action: "auth.lockout" } }),
    ).toBe(1);
  });

  it("AC19: more than 20 failures from one IP are rate limited without a password check", async () => {
    const now = new Date();
    const ip = "192.0.2.50";
    for (let i = 0; i < 20; i += 1) {
      const r = await beginLogin(
        { email: `nobody-${i}@example.org`, password: "whatever pass" },
        { ip, now },
      );
      expect(r).toMatchObject({ ok: false, formError: GENERIC_MSG });
    }
    verifySpy.mockClear();
    const limited = await beginLogin(
      { email: "nobody-x@example.org", password: "whatever pass" },
      { ip, now },
    );
    expect(limited).toMatchObject({ ok: false, formError: RATE_LIMITED_MSG });
    expect(verifySpy).not.toHaveBeenCalled();
    // Another network is unaffected.
    const other = await beginLogin(
      { email: "nobody-y@example.org", password: "whatever pass" },
      { ip: "192.0.2.51", now },
    );
    expect(other).toMatchObject({ formError: GENERIC_MSG });
  });
});

describe("login: challenge and TOTP", () => {
  it("expired challenge, max attempts and single use", async () => {
    const owner = await makeOwner();
    const ip = "198.51.100.10";
    const now = new Date();
    const r = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!r.ok) throw new Error("step 1 failed");
    const code = await generateTotp(owner.totpSecret, now);

    const late = new Date(now.getTime() + 6 * 60_000);
    const expired = await rejection(
      completeLogin({ challengeToken: r.token, code }, { ip, now: late }),
    );
    expect((expired as InvalidLoginError).code).toBe("challenge_expired");

    const user = await completeLogin(
      { challengeToken: r.token, code },
      { ip, now },
    );
    expect(user).toMatchObject({ id: owner.id, role: "OWNER" });
    const reused = await rejection(
      completeLogin({ challengeToken: r.token, code }, { ip, now }),
    );
    expect((reused as InvalidLoginError).code).toBe("challenge_expired");
  });

  it("a challenge dies after 5 wrong codes", async () => {
    const owner = await makeOwner();
    const ip = "198.51.100.11";
    const now = new Date();
    const r = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!r.ok) throw new Error("step 1 failed");
    const good = await generateTotp(owner.totpSecret, now);
    const wrong = good === "000000" ? "111111" : "000000";
    const codes: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const e = await rejection(
        completeLogin({ challengeToken: r.token, code: wrong }, { ip, now }),
      );
      codes.push((e as InvalidLoginError).code);
    }
    expect(codes).toEqual([
      "invalid_code",
      "invalid_code",
      "invalid_code",
      "invalid_code",
      "challenge_expired",
    ]);
    const sixth = await rejection(
      completeLogin({ challengeToken: r.token, code: good }, { ip, now }),
    );
    expect((sixth as InvalidLoginError).code).toBe("challenge_expired");
  });

  it("AC20: a TOTP code accepted once cannot be replayed", async () => {
    const owner = await makeOwner();
    const ip = "198.51.100.12";
    const now = new Date();
    const code = await generateTotp(owner.totpSecret, now);
    const first = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!first.ok) throw new Error("step 1 failed");
    await completeLogin({ challengeToken: first.token, code }, { ip, now });

    const second = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!second.ok) throw new Error("step 1 failed");
    const replay = await rejection(
      completeLogin({ challengeToken: second.token, code }, { ip, now }),
    );
    expect((replay as InvalidLoginError).code).toBe("invalid_code");
  });

  it("wrong code via the action keeps the step and shows the code error", async () => {
    const owner = await makeOwner();
    await startLoginAction(
      null,
      form({ email: owner.email, password: owner.password }),
    );
    const good = await generateTotp(owner.totpSecret);
    const result = await completeLoginAction(
      null,
      form({ code: good === "000000" ? "111111" : "000000", step: "verify" }),
    );
    expect(result).toMatchObject({
      ok: false,
      step: "verify",
      fieldErrors: { code: INVALID_CODE_MSG },
    });
  });

  it("missing challenge cookie sends the user back to step 1", async () => {
    const result = await completeLoginAction(null, form({ code: "123456" }));
    expect(result).toMatchObject({
      ok: false,
      step: "credentials",
      formError: EXPIRED_MSG,
    });
  });

  it("corrupted totpSecretEnc -> GENERIC_MSG at step 'credentials' and log.error", async () => {
    const owner = await makeOwner();
    await startLoginAction(
      null,
      form({ email: owner.email, password: owner.password }),
    );
    const parts = owner.totpSecretEnc!.split(":");
    const ct = parts[3]!;
    parts[3] = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    await prisma.adminUser.update({
      where: { id: owner.id },
      data: { totpSecretEnc: parts.join(":") },
    });
    const errorSpy = vi.spyOn(log, "error").mockImplementation(() => {});
    try {
      const result = await completeLoginAction(
        null,
        form({ code: await generateTotp(owner.totpSecret), step: "verify" }),
      );
      expect(result).toMatchObject({
        ok: false,
        step: "credentials",
        formError: GENERIC_MSG,
      });
      expect(errorSpy).toHaveBeenCalledWith(
        "auth.login.error",
        expect.objectContaining({ name: "CallbackRouteError" }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("login: concurrency", () => {
  it("AC18: 10 parallel wrong passwords -> <= 5 real-hash verifies, one lock, one auth.lockout row", async () => {
    const owner = await makeOwner();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        startLoginAction(
          null,
          form({ email: owner.email, password: "wrong password!!" }),
        ),
      ),
    );
    expect(results.every((r) => r.formError === GENERIC_MSG)).toBe(true);
    const calls = realHashCalls(owner);
    console.info(`[AC18] real-hash verifyPassword calls: ${calls}`);
    expect(calls).toBeLessThanOrEqual(5);
    const row = await prisma.adminUser.findUniqueOrThrow({
      where: { id: owner.id },
    });
    expect(row.lockedUntil).not.toBeNull();
    expect(
      await prisma.auditLog.count({ where: { action: "auth.lockout" } }),
    ).toBe(1);
  });

  it("AC19: 30 parallel step-1 calls from one IP -> <= 20 password/dummy checks", async () => {
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        beginLogin(
          { email: `parallel-${i}@example.org`, password: "whatever pass" },
          { ip: "192.0.2.99", now },
        ),
      ),
    );
    const checks = verifySpy.mock.calls.length;
    const limited = results.filter(
      (r) => !r.ok && r.formError === RATE_LIMITED_MSG,
    ).length;
    console.info(
      `[AC19] hash checks: ${checks}, rate-limited responses: ${limited}`,
    );
    expect(checks).toBeLessThanOrEqual(20);
    expect(limited).toBeGreaterThanOrEqual(10);
  });

  it("AC20: 2 parallel completions with the same challenge and code -> exactly 1 success", async () => {
    const owner = await makeOwner();
    const ip = "198.51.100.20";
    const now = new Date();
    const r = await beginLogin(
      { email: owner.email, password: owner.password },
      { ip, now },
    );
    if (!r.ok) throw new Error("step 1 failed");
    const code = await generateTotp(owner.totpSecret, now);
    const settled = await Promise.allSettled([
      completeLogin({ challengeToken: r.token, code }, { ip, now }),
      completeLogin({ challengeToken: r.token, code }, { ip, now }),
    ]);
    const ok = settled.filter((s) => s.status === "fulfilled");
    const failed = settled.filter(
      (s): s is PromiseRejectedResult => s.status === "rejected",
    );
    console.info(
      `[AC20] fulfilled: ${ok.length}, rejected: ${failed.map((f) => (f.reason as InvalidLoginError).code).join(",")}`,
    );
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.reason).toBeInstanceOf(InvalidLoginError);
    expect((failed[0]!.reason as InvalidLoginError).code).toBe(
      "challenge_expired",
    );
    expect(
      await prisma.auditLog.count({ where: { action: "auth.login.success" } }),
    ).toBe(1);
  });
});
