/**
 * Open-redirect protection for the login `next` parameter: only same-site
 * admin paths are allowed. Pure module.
 */
const ADMIN_PATH_RE = /^\/admin(\/[\w\-/]*)?$/;

export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!ADMIN_PATH_RE.test(value) || value.includes("//")) return null;
  return value;
}
