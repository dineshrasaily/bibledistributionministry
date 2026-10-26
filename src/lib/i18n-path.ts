import { routing, type AppLocale } from "@/i18n/routing";

const locales: readonly string[] = routing.locales;

function normalize(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  // Trim trailing slashes (but keep the root "/").
  path = path.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** Remove a leading locale segment: `/en/about` -> `/about`, `/en` -> `/`. */
export function stripLocale(pathname: string): string {
  const path = normalize(pathname);
  const [, first, ...rest] = path.split("/");
  if (first !== undefined && locales.includes(first)) {
    return rest.length > 0 ? `/${rest.join("/")}` : "/";
  }
  return path;
}

/** Build a locale-prefixed href from a locale-less one: (`en`, `/`) -> `/en`. */
export function localizedHref(locale: AppLocale, href: string): string {
  const path = stripLocale(href);
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Same page in another locale: `/en/about` -> `/ne/about`. */
export function switchLocalePath(pathname: string, target: AppLocale): string {
  return localizedHref(target, pathname);
}
