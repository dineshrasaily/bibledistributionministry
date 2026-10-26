import { getTranslations } from "next-intl/server";
import { DemoBadge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedSiteSettings } from "@/lib/site-settings";

export async function MinistryIntro({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const site = await getLocalizedSiteSettings(locale);

  return (
    <section aria-labelledby="intro-title" className="bg-ivory py-20 md:py-28">
      <Container className="grid items-center gap-12 md:grid-cols-[1.2fr_1fr] md:gap-16">
        <div className="flex flex-col gap-6">
          <SectionHeader
            id="intro-title"
            eyebrow={t("introEyebrow")}
            title={t("introTitle")}
          />
          {site.aboutIntroParagraphs.map((paragraph, index) => (
            <p key={index} className="text-navy/85">
              {paragraph}
            </p>
          ))}
          {site.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null}
        </div>

        {/* Decorative panel: no stock photography. */}
        <div
          aria-hidden="true"
          className="relative mx-auto aspect-[4/5] w-full max-w-sm rounded-lg bg-beige p-3"
        >
          <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-gold/60">
            <svg viewBox="0 0 120 160" className="h-40 w-auto" fill="none">
              <circle cx="60" cy="58" r="40" stroke="#B8924A" strokeWidth="1" />
              <circle
                cx="60"
                cy="58"
                r="52"
                stroke="#B8924A"
                strokeWidth="0.75"
                strokeDasharray="2 6"
              />
              <rect
                x="56"
                y="20"
                width="8"
                height="128"
                rx="2"
                fill="#1E2A44"
              />
              <rect x="30" y="46" width="60" height="8" rx="2" fill="#1E2A44" />
            </svg>
            <p className="px-6 text-center font-serif text-lg text-navy">
              {t("introPanelLabel")}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
