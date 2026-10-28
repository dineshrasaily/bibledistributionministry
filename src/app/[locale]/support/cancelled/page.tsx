import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/public/PageHero";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { routing } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(
    params,
    "supportCancelled",
    "/support/cancelled",
    { noindex: true },
  );
}

export default async function SupportCancelledPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "SupportCancelled" });

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("body")}
      />
      <section className="pb-16 md:pb-24">
        <Container className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href={localizedHref(locale, "/support")} size="lg">
            {t("back")}
          </Button>
          <Button
            href={localizedHref(locale, "/contact")}
            variant="secondary"
            size="lg"
          >
            {t("contactLink")}
          </Button>
        </Container>
      </section>
    </>
  );
}
