import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/public/ContactForm";
import { PageHero } from "@/components/public/PageHero";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { routing } from "@/i18n/routing";
import { localizedPageMetadata } from "@/lib/metadata";
import { getLocalizedSiteSettings } from "@/lib/site-settings";
import { getTurnstileConfig } from "@/server/forms/turnstile";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "contact", "/contact");
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const site = await getLocalizedSiteSettings(locale);
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
              <ContactForm siteKey={siteKey} />
            </CardBody>
          </Card>
          <aside
            aria-labelledby="contact-aside"
            className="flex flex-col gap-4 rounded-lg border border-beige bg-ivory p-6 sm:p-8"
          >
            <h2
              id="contact-aside"
              className="font-serif text-2xl font-semibold text-navy"
            >
              {t("asideTitle")}
            </h2>
            <span aria-hidden="true" className="gold-rule" />
            <p className="text-navy/85">{t("asideBody")}</p>
            <p className="text-navy/85">
              {t("emailAside")}{" "}
              <a
                href={`mailto:${site.contactEmail}`}
                className="font-medium break-all text-navy underline decoration-gold-dark underline-offset-2"
              >
                {site.contactEmail}
              </a>
            </p>
          </aside>
        </Container>
      </section>
    </>
  );
}
