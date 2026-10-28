import "server-only";
import { log } from "@/lib/log";
import { isSameOrigin } from "@/lib/same-origin";
import { type AdminActor, getCurrentAdmin } from "./guards";

const deny = (status: number, error: string) =>
  Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );

/**
 * Guard for admin route handlers (`/api/admin/*`). Returns the actor, or a
 * JSON error Response to return as-is:
 * - 401 UNAUTHENTICATED without a valid session (deactivated users and
 *   bumped sessionVersions are rejected, as in requireAdmin);
 * - 403 FORBIDDEN_ORIGIN for mutations that are not same-origin (route
 *   handlers get no built-in CSRF check, unlike server actions).
 */
export async function requireAdminRoute(
  request: Request,
  { mutation }: { mutation: boolean },
): Promise<AdminActor | Response> {
  const url = new URL(request.url);
  const actor = await getCurrentAdmin();
  if (!actor) {
    log.warn("admin.route.denied", {
      path: url.pathname,
      code: "UNAUTHENTICATED",
    });
    return deny(401, "UNAUTHENTICATED");
  }
  if (mutation && !isSameOrigin(request.headers, url.origin)) {
    log.warn("admin.route.denied", {
      path: url.pathname,
      code: "FORBIDDEN_ORIGIN",
    });
    return deny(403, "FORBIDDEN_ORIGIN");
  }
  return actor;
}
