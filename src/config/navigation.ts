/** Locale-less hrefs; render them with a localized link helper. */
export type NavKey =
  | "home"
  | "about"
  | "devotionals"
  | "missions"
  | "media"
  | "prayer"
  | "support"
  | "contact"
  | "privacy"
  | "terms";

export type NavItem = { key: NavKey; href: string };

export const mainNav: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "about", href: "/about" },
  { key: "devotionals", href: "/devotionals" },
  { key: "missions", href: "/missions" },
  { key: "media", href: "/media" },
  { key: "prayer", href: "/prayer" },
  { key: "support", href: "/support" },
  { key: "contact", href: "/contact" },
];

/** Pages hidden from the header nav; still linked from the footer. */
const headerExcluded: ReadonlySet<NavKey> = new Set([
  "about",
  "support",
  "contact",
]);

/** Header (desktop + mobile menu) links: a subset of mainNav. */
export const headerNav: readonly NavItem[] = mainNav.filter(
  (item) => !headerExcluded.has(item.key),
);

export const legalNav: readonly NavItem[] = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
];
