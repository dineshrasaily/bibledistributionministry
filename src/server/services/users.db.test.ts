import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  createEditorAction,
  resetEditorTotpAction,
  setEditorPasswordAction,
  setUserActiveAction,
} from "@/server/actions/users";
import { verifyPassword } from "@/server/auth/password";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeEditor, makeOwner, type TestAdmin } from "@/test/factories";
import { form } from "@/test/forms";

const LIMIT_PREFIX = "You can have at most 3 active editors.";
const PASSWORD = "temporary password 123";

let owner: TestAdmin;
let n = 0;

const editorForm = () => {
  n += 1;
  return form({
    name: `Editor ${n}`,
    email: ` Editor${n}@Example.org `,
    password: PASSWORD,
    confirmPassword: PASSWORD,
  });
};

const activeEditors = () =>
  prisma.adminUser.count({ where: { role: "EDITOR", isActive: true } });

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  owner = await makeOwner();
  setTestSession(owner);
});

describe("AC21: max 3 active editors", () => {
  it("creates up to 3 editors; the 4th fails with the limit message", async () => {
    for (let i = 0; i < 3; i += 1) {
      const result = await createEditorAction(null, editorForm());
      expect(result).toMatchObject({ ok: true });
    }
    const fourth = await createEditorAction(null, editorForm());
    expect(fourth.ok).toBe(false);
    if (fourth.ok) return;
    expect(fourth.code).toBe("LIMIT");
    expect(fourth.formError?.startsWith(LIMIT_PREFIX)).toBe(true);
    expect(await activeEditors()).toBe(3);
    expect(
      await prisma.auditLog.count({ where: { action: "user.create" } }),
    ).toBe(3);
  });

  it("stores the email trimmed and lower-cased, without 2FA", async () => {
    const result = await createEditorAction(null, editorForm());
    expect(result.ok).toBe(true);
    const editor = await prisma.adminUser.findUniqueOrThrow({
      where: { email: `editor${n}@example.org` },
    });
    expect(editor).toMatchObject({ role: "EDITOR", totpEnabled: false });
    expect(await verifyPassword(editor.passwordHash, PASSWORD)).toBe(true);
  });

  it("3 concurrent creates with 2 existing -> exactly 1 success", async () => {
    await makeEditor();
    await makeEditor();
    const results = await Promise.all([
      createEditorAction(null, editorForm()),
      createEditorAction(null, editorForm()),
      createEditorAction(null, editorForm()),
    ]);
    const ok = results.filter((r) => r.ok).length;
    const limited = results.filter((r) => !r.ok && r.code === "LIMIT").length;
    console.info(`[AC21] concurrent creates: ${ok} ok, ${limited} LIMIT`);
    expect(ok).toBe(1);
    expect(limited).toBe(2);
    expect(await activeEditors()).toBe(3);
  });

  it("a deactivated editor frees a slot; reactivating at the limit fails", async () => {
    const editors = [
      await makeEditor(),
      await makeEditor(),
      await makeEditor(),
    ];
    const off = await setUserActiveAction(
      null,
      form({ id: editors[0]!.id, active: "false" }),
    );
    expect(off).toMatchObject({ ok: true });
    const deactivated = await prisma.adminUser.findUniqueOrThrow({
      where: { id: editors[0]!.id },
    });
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.sessionVersion).toBe(editors[0]!.sessionVersion + 1);

    expect(await createEditorAction(null, editorForm())).toMatchObject({
      ok: true,
    });
    const reactivate = await setUserActiveAction(
      null,
      form({ id: editors[0]!.id, active: "true" }),
    );
    expect(reactivate).toMatchObject({ ok: false, code: "LIMIT" });
    if (!reactivate.ok) {
      expect(reactivate.formError?.startsWith(LIMIT_PREFIX)).toBe(true);
    }
    expect(await activeEditors()).toBe(3);
  });

  it("the owner cannot deactivate themselves", async () => {
    const result = await setUserActiveAction(
      null,
      form({ id: owner.id, active: "false" }),
    );
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      (await prisma.adminUser.findUniqueOrThrow({ where: { id: owner.id } }))
        .isActive,
    ).toBe(true);
  });
});

describe("editor account maintenance", () => {
  it("reset 2FA clears the secret, bumps sessionVersion and deletes challenges", async () => {
    const editor = await makeEditor();
    await prisma.loginChallenge.create({
      data: {
        tokenHash: "x".repeat(64),
        userId: editor.id,
        purpose: "VERIFY",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const result = await resetEditorTotpAction(null, form({ id: editor.id }));
    expect(result).toMatchObject({ ok: true });
    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { id: editor.id },
    });
    expect(after).toMatchObject({
      totpSecretEnc: null,
      totpEnabled: false,
      lastTotpStep: null,
      sessionVersion: editor.sessionVersion + 1,
    });
    expect(await prisma.loginChallenge.count()).toBe(0);
  });

  it("set temporary password re-hashes, unlocks and bumps sessionVersion", async () => {
    const editor = await makeEditor({
      failedLoginCount: 3,
      lockedUntil: new Date(Date.now() + 600_000),
    });
    const result = await setEditorPasswordAction(
      null,
      form({
        id: editor.id,
        password: "a brand new password",
        confirmPassword: "a brand new password",
      }),
    );
    expect(result).toMatchObject({ ok: true });
    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { id: editor.id },
    });
    expect(after.lockedUntil).toBeNull();
    expect(after.failedLoginCount).toBe(0);
    expect(after.sessionVersion).toBe(editor.sessionVersion + 1);
    expect(
      await verifyPassword(after.passwordHash, "a brand new password"),
    ).toBe(true);
  });

  it("owner-only user actions reject the owner as a target", async () => {
    expect(
      await resetEditorTotpAction(null, form({ id: owner.id })),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
