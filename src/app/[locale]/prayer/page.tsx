import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/public/PageHero";
import { PrayerForm } from "@/components/public/PrayerForm";
import { PrayerWall } from "@/components/public/PrayerWall";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { routing } from "@/i18n/routing";
import { listPublicShares } from "@/lib/content";
import { localizedPageMetadata } from "@/lib/metadata";
import { getTurnstileConfig } from "@/server/forms/turnstile";

type PageProps = { params: Promise<{ locale: string }> };

// Rendered per request: an unpublished (consent withdrawn) item must vanish
// from every locale at once, never linger in a stale prerendered copy.
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "prayer", "/prayer");
}

const ASIDE_POINTS = ["private", "anonymous", "consent"] as const;

export default async function PrayerPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "PrayerPage" });
  const shares = await listPublicShares(locale);
  const { siteKey } = getTurnstileConfig();

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("intro")}
      />
      <section aria-label={t("formSection")} className="pb-16 md:pb-24">
        <Container className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
          <Card>
            <CardBody className="gap-6 p-5 sm:p-8">
              <PrayerForm siteKey={siteKey} />
            </CardBody>
          </Card>
          <aside
            aria-labelledby="prayer-aside"
            className="flex flex-col gap-4 rounded-lg border border-beige bg-ivory p-6 sm:p-8"
          >
            <h2
              id="prayer-aside"
              className="font-serif text-2xl font-semibold text-navy"
            >
              {t("asideTitle")}
            </h2>
            <span aria-hidden="true" className="gold-rule" />
            <ul className="flex flex-col gap-4">
              {ASIDE_POINTS.map((key) => (
                <li key={key} className="flex gap-3 text-navy/85">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-2 shrink-0 rounded-full bg-gold-dark"
                  />
                  <span>{t(`asidePoints.${key}`)}</span>
                </li>
              ))}
            </ul>
          </aside>
        </Container>
      </section>
      <PrayerWall locale={locale} items={shares} />
    </>
  );
}
