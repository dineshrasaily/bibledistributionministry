import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { isAdminPath } from "./lib/admin-path";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Not a security boundary: admin auth is enforced server-side in every page/action.
export default function proxy(req: NextRequest) {
  if (isAdminPath(req.nextUrl.pathname)) return NextResponse.next();
  return intlMiddleware(req);
}

export const config = {
  // Skip API routes, the admin area, Next internals and files with an extension (assets).
  // Segment-anchored so /administration or /admins are still localized.
  matcher: "/((?!api(?:/|$)|admin(?:/|$)|trpc(?:/|$)|_next|_vercel|.*\\..*).*)",
};
