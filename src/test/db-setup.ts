/**
 * Per-file setup for the Vitest `db` project: Next.js runtime modules and
 * `@/auth` are replaced with fakes so services and actions can run outside
 * Next.
 */
import { vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Error thrown by the mocked `redirect()` / `notFound()`. */
export class NavigationSignal extends Error {
  constructor(
    readonly kind: "redirect" | "notFound",
    readonly location?: string,
  ) {
    super(kind === "redirect" ? `NEXT_REDIRECT ${location}` : "NEXT_NOT_FOUND");
    this.name = "NavigationSignal";
  }
}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: <T>(fn: T) => fn,
}));

const cookieJar = new Map<string, string>();
const headerBag = new Headers();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    has: (name: string) => cookieJar.has(name),
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
  headers: async () => headerBag,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string) => {
    throw new NavigationSignal("redirect", location);
  }),
  notFound: vi.fn(() => {
    throw new NavigationSignal("notFound");
  }),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof NavigationSignal) throw error;
  },
}));

/** Fake cookie jar / request headers shared with the mocks above. */
export const testRequest = { cookies: cookieJar, headers: headerBag };

type TestSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "OWNER" | "EDITOR";
    sessionVersion: number;
  };
  expires: string;
} | null;

const sessionState = vi.hoisted(() => ({ current: null as unknown }));

/**
 * `@/auth` fake: `auth()` returns the session from `setTestSession()`;
 * `signIn("admin-totp")` runs the real `authorize` and, like @auth/core
 * 0.41.3, passes AuthError subclasses through and wraps anything else in a
 * CallbackRouteError (with `cause.err`).
 */
vi.mock("@/auth", async () => {
  const { AuthError } = await import("next-auth");
  const { authorizeAdminTotp } = await import("@/server/auth/login");
  return {
    auth: vi.fn(async () => sessionState.current),
    signIn: vi.fn(
      async (_provider: string, options: Record<string, unknown> = {}) => {
        try {
          await authorizeAdminTotp(options);
        } catch (err) {
          if (err instanceof AuthError) throw err;
          const wrapped = new Error("Read more at https://errors.authjs.dev");
          wrapped.name = "CallbackRouteError";
          Object.assign(wrapped, {
            type: "CallbackRouteError",
            cause: { err },
          });
          throw wrapped;
        }
        return "/admin";
      },
    ),
    signOut: vi.fn(async () => undefined),
    handlers: { GET: vi.fn(), POST: vi.fn() },
  };
});

/** Sets (or clears) the session `auth()` returns, from an AdminUser row. */
export function setTestSession(
  user: {
    id: string;
    email: string;
    name: string;
    role: "OWNER" | "EDITOR";
    sessionVersion: number;
  } | null,
): void {
  const session: TestSession = user
    ? {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
      }
    : null;
  sessionState.current = session;
}

/** Empties every model table (list derived from Prisma.ModelName). */
export async function resetDb(): Promise<void> {
  const tables = Object.values(Prisma.ModelName)
    .map((name) => `"${name}"`)
    .join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
  cookieJar.clear();
  for (const key of [...headerBag.keys()]) headerBag.delete(key);
  sessionState.current = null;
}
