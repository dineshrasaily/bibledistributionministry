import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { clock } from "@/server/auth/login";
import { verifyPassword } from "@/server/auth/password";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeEditor, makeOwner, type TestAdmin } from "@/test/factories";
import { form } from "@/test/forms";
import { changePasswordAction } from "./account";
import { logoutAction } from "./auth";
import { previewMarkdownAction } from "./markdown";

vi.mock("@/server/auth/password", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/server/auth/password")>();
  return { ...m, verifyPassword: vi.fn(m.verifyPassword) };
});

const verifySpy = vi.mocked(verifyPassword);
const NEW_PASSWORD = "a completely new password";

const changeForm = (currentPassword: string) =>
  form({
    currentPassword,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  });

const reload = (user: TestAdmin) =>
  prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("changePasswordAction", () => {
  it("changes the password, revokes sessions, audits and signs out", async () => {
    const editor = await makeEditor();
    setTestSession(editor);
    const result = await changePasswordAction(
      null,
      changeForm(editor.password),
    );
    expect(result).toMatchObject({ ok: true });
    const after = await reload(editor);
    expect(await verifyPassword(after.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(after.sessionVersion).toBe(editor.sessionVersion + 1);
    expect(
      await prisma.auditLog.count({
        where: { action: "account.password.change" },
      }),
    ).toBe(1);
    expect(signOut).toHaveBeenCalledWith({
      redirectTo: "/admin/login?changed=1",
    });
  });

  it("5 wrong current passwords lock, bump sessionVersion and audit each failure", async () => {
    const editor = await makeEditor();
    setTestSession(editor);
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(await changePasswordAction(null, changeForm("wrong one!!")));
    }
    expect(
      results
        .slice(0, 4)
        .every((r) => r.ok === false && r.code === "VALIDATION"),
    ).toBe(true);
    expect(results[0]).toMatchObject({
      fieldErrors: { currentPassword: "Your current password is incorrect." },
    });
    expect(results[4]).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });

    const locked = await reload(editor);
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.sessionVersion).toBe(editor.sessionVersion + 1);
    expect(
      await prisma.auditLog.count({
        where: { action: "auth.password.change_failed" },
      }),
    ).toBe(5);

    // The old session is revoked.
    expect(
      await changePasswordAction(null, changeForm(editor.password)),
    ).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });

    // A session with the new sessionVersion gets the lock message without a hash check.
    setTestSession(locked);
    verifySpy.mockClear();
    const duringLock = await changePasswordAction(
      null,
      changeForm(editor.password),
    );
    expect(duringLock).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        currentPassword:
          "Too many incorrect attempts. Try again in 15 minutes.",
      },
    });
    expect(verifySpy).not.toHaveBeenCalled();

    // After the lock expires the correct password works.
    const later = new Date(Date.now() + 16 * 60_000);
    vi.spyOn(clock, "now").mockReturnValue(later);
    const ok = await changePasswordAction(null, changeForm(editor.password));
    expect(ok).toMatchObject({ ok: true });
    expect(
      await prisma.auditLog.count({
        where: { action: "account.password.change" },
      }),
    ).toBe(1);
  });

  it("validation errors return field errors and touch nothing", async () => {
    const editor = await makeEditor();
    setTestSession(editor);
    const result = await changePasswordAction(
      null,
      form({
        currentPassword: editor.password,
        newPassword: "short",
        confirmPassword: "short",
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await reload(editor)).failedLoginCount).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("without a session -> UNAUTHENTICATED", async () => {
    setTestSession(null);
    expect(await changePasswordAction(null, changeForm("x"))).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});

describe("logoutAction", () => {
  it("bumps sessionVersion, writes auth.logout and signs out", async () => {
    const owner = await makeOwner();
    setTestSession(owner);
    await logoutAction();
    expect((await reload(owner)).sessionVersion).toBe(owner.sessionVersion + 1);
    expect(
      await prisma.auditLog.count({ where: { action: "auth.logout" } }),
    ).toBe(1);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/admin/login" });
  });

  it("without a valid session it only clears the cookie", async () => {
    setTestSession(null);
    await logoutAction();
    expect(await prisma.auditLog.count()).toBe(0);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/admin/login" });
  });
});

describe("previewMarkdownAction", () => {
  it("requires a session", async () => {
    setTestSession(null);
    expect(await previewMarkdownAction("# Hi")).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("returns sanitized HTML with no audit row and no revalidation", async () => {
    setTestSession(await makeEditor());
    const result = await previewMarkdownAction(
      "# Title\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("<h2>Title</h2>");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("javascript:");
    expect(await prisma.auditLog.count()).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects input over 50,000 characters", async () => {
    setTestSession(await makeEditor());
    expect(await previewMarkdownAction("x".repeat(50_001))).toMatchObject({
      ok: false,
      code: "VALIDATION",
      formError: "Preview is limited to 50,000 characters.",
    });
  });
});
