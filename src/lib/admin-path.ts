/** True for `/admin` and everything below it (not `/administration`). Pure module. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
