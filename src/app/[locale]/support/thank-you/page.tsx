import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHero } from "@/components/public/PageHero";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { routing } from "@/i18n/routing";
import { donationDisclosure } from "@/lib/donation-wording";
import { resolveStripeConfig } from "@/lib/donations/stripe-config";
import { manageMonthlyOf } from "@/lib/donations/support-view";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";
import { getLocalizedSiteSettings, getSiteSettings } from "@/lib/site-settings";

type PageProps = { params: Promise<{ locale: string }> };

// Per request (tax flag + portal link). The ?session_id=... Stripe adds is
// deliberately ignored: no Stripe call, nothing about the payment is shown.
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "supportThanks", "/support/thank-you", {
    noindex: true,
  });
}

const linkClass =
  "font-medium text-navy underline decoration-gold-dark underline-offset-2 hover:decoration-2 break-all";

export default async function SupportThanksPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "SupportThanks" });
  const tSupport = await getTranslations({ locale, namespace: "SupportPage" });
  const [row, site] = await Promise.all([
    getSiteSettings(),
    getLocalizedSiteSettings(locale),
  ]);
  const { taxNote } = donationDisclosure(locale, row.taxDeductibleVerified);
  const manage = manageMonthlyOf(resolveStripeConfig(process.env).portalUrl);
  const email = site.contactEmail;
  const mailLink = (chunks: ReactNode) => (
    <a href={`mailto:${email}`} className={linkClass}>
      {chunks}
    </a>
  );

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("body")}
      />
      <section className="pb-16 md:pb-24">
        <Container className="max-w-2xl">
          <Card>
            <CardBody className="gap-4 p-6 sm:p-8">
              <span aria-hidden="true" className="gold-rule" />
              <p className="text-navy/85" data-testid="support-tax-note">
                {taxNote}
              </p>
              <p className="text-navy/85">
                {manage.kind === "portal" ? (
                  <a
                    href={manage.url}
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {tSupport("manageMonthlyLink")}
                  </a>
                ) : (
                  tSupport.rich("manageMonthlyEmail", {
                    email,
                    link: mailLink,
                  })
                )}
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Button href={localizedHref(locale, "/")} size="lg">
                  {t("backHome")}
                </Button>
                <Button
                  href={localizedHref(locale, "/prayer")}
                  variant="secondary"
                  size="lg"
                >
                  {t("prayLink")}
                </Button>
              </div>
            </CardBody>
          </Card>
        </Container>
      </section>
    </>
  );
}
