import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import { getLocalizedSiteSettings } from "@/lib/site-settings";
import { DesktopNav } from "./DesktopNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";

export async function Header({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Header" });
  const site = await getLocalizedSiteSettings(locale);

  return (
    <header className="sticky top-0 z-40 border-b border-gold/30 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
      {/* Three columns: brand (left) · nav + language (center) · CTA (right).
          DOM order matches visual order so keyboard focus flows left to right. */}
      {/* Full-bleed (no max-width) so the brand sits at the far left edge. */}
      <Container className="flex h-[4.5rem] max-w-none items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:grid xl:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 justify-start">
          <Link
            href={localizedHref(locale, "/")}
            aria-label={t("homeLinkLabel", { name: site.name })}
            className="flex min-w-0 items-center gap-2.5 rounded-md"
          >
            {site.logoUrl ? (
              // logo stays <img>: fixed tiny size; header layout is user-customized
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.logoUrl}
                alt=""
                className="h-10 w-auto max-w-[6.5rem] shrink-0 object-contain sm:h-12"
              />
            ) : (
              <Logo decorative />
            )}
            <span className="line-clamp-2 font-serif text-lg leading-tight font-semibold tracking-tight text-navy sm:line-clamp-1 sm:text-[1.35rem]">
              {site.name}
            </span>
          </Link>
        </div>

        <div className="hidden items-center justify-center gap-3 xl:flex">
          <DesktopNav className="hidden xl:block" />
          <span
            aria-hidden="true"
            className="hidden h-6 w-px bg-gold/40 xl:block"
          />
          <LanguageSwitcher className="hidden xl:block" />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            href={localizedHref(locale, "/support")}
            variant="gold"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {t("supportCta")}
          </Button>
          <MobileMenu className="xl:hidden" />
        </div>
      </Container>
    </header>
  );
}
