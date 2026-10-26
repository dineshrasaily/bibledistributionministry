import { getTranslations } from "next-intl/server";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import { getLocalizedSiteSettings } from "@/lib/site-settings";

export async function Hero({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const site = await getLocalizedSiteSettings(locale);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-ivory"
    >
      {/* Soft beige wash and a faint ring of light behind the heading. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,var(--color-beige)_0%,transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-10 left-1/2 size-[34rem] -translate-x-1/2 rounded-full border border-gold/20"
      />
      <Container className="relative flex flex-col items-center py-20 text-center motion-safe:animate-fade-up md:py-28">
        {site.tagline ? (
          <>
            <p className="text-sm font-semibold tracking-[0.2em] text-gold-dark uppercase">
              {site.tagline}
            </p>
            <span aria-hidden="true" className="mt-5 gold-rule" />
          </>
        ) : null}
        <h1
          id="hero-title"
          className="mt-6 font-serif text-4xl leading-tight font-semibold tracking-tight text-navy sm:text-5xl lg:text-6xl"
        >
          {site.name}
        </h1>
        {site.missionStatement ? (
          <p className="mt-6 max-w-2xl text-lg text-navy/85 sm:text-xl">
            {site.missionStatement}
          </p>
        ) : null}
        {site.isDemo ? (
          <DemoBadge label={tCommon("demoBadge")} className="mt-4" />
        ) : null}
        <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          <Button href={localizedHref(locale, "/about")} size="lg">
            {t("ctaLearnMore")}
          </Button>
          <Button
            href={localizedHref(locale, "/prayer")}
            variant="secondary"
            size="lg"
          >
            {t("ctaPrayer")}
          </Button>
          <Button
            href={localizedHref(locale, "/support")}
            variant="gold"
            size="lg"
          >
            {t("ctaSupport")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
