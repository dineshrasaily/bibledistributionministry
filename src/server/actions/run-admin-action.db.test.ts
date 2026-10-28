import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DomainError } from "@/server/errors";
import { resetDb, setTestSession } from "@/test/db-setup";
import { makeOwner } from "@/test/factories";
import { runAdminAction } from "./run-admin-action";

const schema = z.object({ title: z.string().min(1) });

function def(overrides: Partial<Parameters<typeof runAdminAction>[0]> = {}) {
  return {
    name: "test.hooks",
    role: "ADMIN" as const,
    schema,
    entityType: "Test",
    revalidate: [] as Array<"public" | "admin">,
    successMessage: "Done.",
    run: vi.fn(async () => ({ entityId: "x", metadata: { ok: true } })),
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDb();
});

describe("runAdminAction prepare / afterCommit (Phase 7)", () => {
  it("a DomainError in prepare is a field error; run and the audit row are skipped", async () => {
    setTestSession(await makeOwner());
    const d = def({
      prepare: async () => {
        throw new DomainError("VALIDATION", "Bad file.", "ref");
      },
    });
    const afterCommit = vi.fn();
    const result = await runAdminAction({ ...d, afterCommit }, { title: "t" });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      formError: "Bad file.",
      fieldErrors: { ref: "Bad file." },
    });
    expect(d.run).not.toHaveBeenCalled();
    expect(afterCommit).not.toHaveBeenCalled();
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("prepare's output is what run receives; afterCommit runs once after the commit", async () => {
    setTestSession(await makeOwner());
    const run = vi.fn(
      async (_tx: unknown, input: { title: string; extra: number }) => ({
        entityId: input.title,
        data: input.extra,
      }),
    );
    const afterCommit = vi.fn(async () => {
      expect(await prisma.auditLog.count()).toBe(1); // already committed
    });
    const result = await runAdminAction(
      {
        ...def(),
        prepare: async (input: unknown) => ({
          ...(input as { title: string }),
          extra: 7,
        }),
        run,
        afterCommit,
      },
      { title: "t" },
    );
    expect(result).toEqual({ ok: true, message: "Done.", data: 7 });
    expect(run.mock.calls[0]![1]).toEqual({ title: "t", extra: 7 });
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it("afterCommit is skipped when run fails, and its own errors never change the result", async () => {
    setTestSession(await makeOwner());
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const afterCommit = vi.fn(async () => {
      throw new Error("storage down");
    });
    const failing = await runAdminAction(
      {
        ...def({
          run: async () => {
            throw new DomainError("CONFLICT", "In use.");
          },
        }),
        afterCommit,
      },
      { title: "t" },
    );
    expect(failing).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(afterCommit).not.toHaveBeenCalled();

    const ok = await runAdminAction({ ...def(), afterCommit }, { title: "t" });
    expect(ok).toMatchObject({ ok: true });
    expect(afterCommit).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls.flat().join(" ")).toContain(
      "admin.action.after_commit_failed",
    );
    errors.mockRestore();
  });
});
