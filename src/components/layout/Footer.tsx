import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { DemoBadge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { legalNav, mainNav } from "@/config/navigation";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import { getLocalizedSiteSettings } from "@/lib/site-settings";

const linkClass =
  "rounded-sm text-white/80 transition-colors hover:text-white focus-visible:outline-gold";

export async function Footer({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Footer" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const site = await getLocalizedSiteSettings(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-gold/70 bg-navy-deep text-white/80">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            {site.logoUrl ? (
              // TODO(Phase 7): next/image + Blob
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.logoUrl}
                alt=""
                className="size-10 shrink-0 object-contain"
              />
            ) : (
              <Logo decorative className="size-10" />
            )}
            <p className="font-serif text-2xl font-semibold text-white">
              {site.name}
            </p>
          </div>
          <p className="max-w-sm">{t("missionLine")}</p>
          {site.isDemo ? (
            <DemoBadge tone="dark" label={tCommon("demoBadge")} />
          ) : null}
        </div>

        <nav aria-labelledby="footer-nav-heading">
          <h2
            id="footer-nav-heading"
            className="mb-4 font-sans text-sm font-semibold tracking-[0.16em] text-gold uppercase"
          >
            {t("navHeading")}
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {mainNav.map((item) => (
              <li key={item.key}>
                <Link
                  href={localizedHref(locale, item.href)}
                  className={linkClass}
                >
                  {tNav(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-4 font-sans text-sm font-semibold tracking-[0.16em] text-gold uppercase">
              {t("contactHeading")}
            </h2>
            <a href={`mailto:${site.contactEmail}`} className={linkClass}>
              {site.contactEmail}
            </a>
          </div>
          <div>
            <h2 className="mb-4 font-sans text-sm font-semibold tracking-[0.16em] text-gold uppercase">
              {t("socialHeading")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {site.socialLinks.map((s) => (
                <li key={s.platform}>
                  {s.url ? (
                    <a
                      href={s.url}
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {s.label}
                    </a>
                  ) : (
                    <>
                      {s.label}{" "}
                      <span className="text-sm text-white/80">
                        {t("placeholder")}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year, name: site.name })}</p>
          <nav aria-label={t("legalHeading")}>
            <ul className="flex gap-5">
              {legalNav.map((item) => (
                <li key={item.key}>
                  <Link
                    href={localizedHref(locale, item.href)}
                    className={linkClass}
                  >
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
    </footer>
  );
}
