import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ne"],
  defaultLocale: "en",
  localePrefix: "always",
  // `/` must always redirect to `/en`, regardless of Accept-Language.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
