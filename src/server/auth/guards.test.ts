// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

class Redirect extends Error {
  constructor(readonly location: string) {
    super(`NEXT_REDIRECT ${location}`);
  }
}

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  prisma: { adminUser: { findUnique: mocks.findUnique } },
}));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Redirect(location);
  },
}));

const {
  AuthzError,
  requireAdmin,
  requireAdminPage,
  requireOwner,
  requireOwnerPage,
  resolveActor,
} = await import("./guards");

const owner = {
  id: "owner-1",
  email: "owner@example.org",
  name: "Owner",
  role: "OWNER" as const,
  isActive: true,
  sessionVersion: 3,
};
const editor = { ...owner, id: "editor-1", role: "EDITOR" as const };

const sessionFor = (u: { id: string; sessionVersion: number }) => ({
  user: { id: u.id, sessionVersion: u.sessionVersion },
});

async function codeOf(promise: Promise<unknown>) {
  const e = await promise.catch((err: unknown) => err);
  return e instanceof AuthzError ? e.code : e;
}

async function locationOf(promise: Promise<unknown>) {
  const e = await promise.catch((err: unknown) => err);
  return e instanceof Redirect ? e.location : e;
}

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.findUnique.mockReset();
});

describe("resolveActor", () => {
  const load = (row: typeof owner | null) => async () => row;

  it("returns null without a session", async () => {
    expect(await resolveActor(null, load(owner))).toBeNull();
    expect(await resolveActor({ user: null }, load(owner))).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    expect(await resolveActor(sessionFor(owner), load(null))).toBeNull();
  });

  it("returns null for an inactive user", async () => {
    expect(
      await resolveActor(
        sessionFor(owner),
        load({ ...owner, isActive: false }),
      ),
    ).toBeNull();
  });

  it("returns null on a sessionVersion mismatch", async () => {
    expect(
      await resolveActor(
        { user: { id: owner.id, sessionVersion: 2 } },
        load(owner),
      ),
    ).toBeNull();
  });

  it("takes role and name from the DB row", async () => {
    expect(await resolveActor(sessionFor(owner), load(owner))).toEqual({
      id: owner.id,
      email: owner.email,
      name: owner.name,
      role: "OWNER",
    });
  });
});

describe("requireAdmin / requireOwner", () => {
  it("UNAUTHENTICATED without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await codeOf(requireAdmin())).toBe("UNAUTHENTICATED");
    expect(await codeOf(requireOwner())).toBe("UNAUTHENTICATED");
  });

  it("UNAUTHENTICATED for unknown, inactive or revoked sessions", async () => {
    mocks.auth.mockResolvedValue(sessionFor(owner));
    mocks.findUnique.mockResolvedValueOnce(null);
    expect(await codeOf(requireAdmin())).toBe("UNAUTHENTICATED");
    mocks.findUnique.mockResolvedValueOnce({ ...owner, isActive: false });
    expect(await codeOf(requireAdmin())).toBe("UNAUTHENTICATED");
    mocks.findUnique.mockResolvedValueOnce({ ...owner, sessionVersion: 4 });
    expect(await codeOf(requireAdmin())).toBe("UNAUTHENTICATED");
  });

  it("EDITOR passes requireAdmin but gets FORBIDDEN from requireOwner", async () => {
    mocks.auth.mockResolvedValue(sessionFor(editor));
    mocks.findUnique.mockResolvedValue(editor);
    expect((await requireAdmin()).role).toBe("EDITOR");
    expect(await codeOf(requireOwner())).toBe("FORBIDDEN");
  });

  it("OWNER passes both", async () => {
    mocks.auth.mockResolvedValue(sessionFor(owner));
    mocks.findUnique.mockResolvedValue(owner);
    expect((await requireAdmin()).id).toBe(owner.id);
    expect((await requireOwner()).id).toBe(owner.id);
  });
});

describe("page guards", () => {
  it("requireAdminPage redirects to login with next", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await locationOf(requireAdminPage("/admin/posts"))).toBe(
      "/admin/login?next=%2Fadmin%2Fposts",
    );
  });

  it("requireOwnerPage redirects an EDITOR to /admin/forbidden", async () => {
    mocks.auth.mockResolvedValue(sessionFor(editor));
    mocks.findUnique.mockResolvedValue(editor);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await locationOf(requireOwnerPage("/admin/settings"))).toBe(
      "/admin/forbidden",
    );
  });

  it("requireOwnerPage without a session redirects to login", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await locationOf(requireOwnerPage("/admin/settings"))).toBe(
      "/admin/login?next=%2Fadmin%2Fsettings",
    );
  });

  it("requireOwnerPage returns the OWNER", async () => {
    mocks.auth.mockResolvedValue(sessionFor(owner));
    mocks.findUnique.mockResolvedValue(owner);
    expect((await requireOwnerPage("/admin/settings")).role).toBe("OWNER");
  });
});
