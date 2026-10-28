/**
 * CSRF check for admin route handlers (server actions get Next's built-in
 * origin check; route handlers don't). Pure module.
 *
 * The Origin header must equal the request origin, and Sec-Fetch-Site, when
 * the browser sends it, must be "same-origin".
 */
export function isSameOrigin(headers: Headers, origin: string): boolean {
  const sent = headers.get("origin");
  if (!sent || sent === "null" || sent !== origin) return false;
  const site = headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}
