import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { DonationForm } from "@/components/public/DonationForm";
import { OfflineGivingSection } from "@/components/public/OfflineGivingSection";
import { PageHero } from "@/components/public/PageHero";
import {
  SupportBullet as Bullet,
  supportLinkClass as linkClass,
} from "@/components/public/SupportBullet";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { offlineTaxNote } from "@/lib/donation-wording";
import { resolveGivingState } from "@/lib/donations/giving-state";
import { resolveStripeConfig } from "@/lib/donations/stripe-config";
import {
  supportSections,
  supportViewModel,
} from "@/lib/donations/support-view";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";
import { toOfflineGiving } from "@/lib/offline-giving";
import { getLocalizedSiteSettings, getSiteSettings } from "@/lib/site-settings";

type PageProps = { params: Promise<{ locale: string }> };

// Rendered per request: the giving state depends on the Stripe env vars and
// on Settings (donationsEnabled, taxDeductibleVerified, Zelle/bank details).
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "support", "/support");
}

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-serif text-3xl leading-tight font-semibold text-navy sm:text-4xl"
    >
      {children}
    </h2>
  );
}

export default async function SupportPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "SupportPage" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const [row, site] = await Promise.all([
    getSiteSettings(),
    getLocalizedSiteSettings(locale),
  ]);
  const config = resolveStripeConfig(process.env);
  const state = resolveGivingState({
    webhookReady: config.webhookReady,
    donationsEnabled: row.donationsEnabled,
  });
  const view = supportViewModel({
    state,
    verified: row.taxDeductibleVerified,
    portalUrl: config.portalUrl,
    locale,
  });
  // Zelle/bank: null when off or empty; account numbers only when shown.
  const offline = toOfflineGiving(row, locale);
  const sections = supportSections(view.kind, offline !== null);

  // "How gifts are used": Nepali when present, else English (marked lang="en").
  const enInfo = row.givingInfoEn?.trim() ? row.givingInfoEn : null;
  const neInfo = row.givingInfoNe?.trim() ? row.givingInfoNe : null;
  const givingInfo =
    locale === "ne" && neInfo
      ? { text: neInfo, lang: undefined }
      : enInfo
        ? { text: enInfo, lang: locale === "ne" ? "en" : undefined }
        : null;

  const email = site.contactEmail;
  const mailLink = (chunks: ReactNode) => (
    <a href={`mailto:${email}`} className={cn(linkClass, "break-all")}>
      {chunks}
    </a>
  );

  const otherWaysButtons = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button href={localizedHref(locale, "/prayer")} size="lg">
        {t("prayLink")}
      </Button>
      <Button
        href={localizedHref(locale, "/contact")}
        variant="secondary"
        size="lg"
      >
        {t("contactLink")}
      </Button>
    </div>
  );

  const blocks: Record<(typeof sections)[number], () => ReactNode> = {
    stripe: () =>
      view.kind === "open" ? (
        <section
          key="stripe"
          aria-labelledby="support-giving"
          data-testid="support-open"
          className="border-t border-beige bg-ivory py-14 md:py-20"
        >
          <Container className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
            <Card>
              <CardBody className="gap-6 p-5 sm:p-8">
                <h2
                  id="support-giving"
                  className="font-serif text-2xl font-semibold text-navy sm:text-3xl"
                >
                  {t("givingSection")}
                </h2>
                <DonationForm />
              </CardBody>
            </Card>
            <aside
              aria-labelledby="support-about-giving"
              data-testid="support-disclosure"
              className="flex flex-col gap-4 rounded-lg border border-beige bg-white p-6 sm:p-8"
            >
              <h2
                id="support-about-giving"
                className="font-serif text-2xl font-semibold text-navy"
              >
                {t("aboutGivingTitle")}
              </h2>
              <span aria-hidden="true" className="gold-rule" />
              <ul className="flex flex-col gap-4">
                <Bullet>{t("processorNote")}</Bullet>
                <Bullet>{t("noCardNote")}</Bullet>
                <Bullet>{t("usdNote")}</Bullet>
                <Bullet>
                  <span data-testid="support-tax-note">{view.taxNote}</span>
                </Bullet>
                <Bullet>
                  {t.rich("refundNote", { email, link: mailLink })}
                </Bullet>
                <Bullet>
                  {view.manageMonthly.kind === "portal" ? (
                    <a
                      href={view.manageMonthly.url}
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {t("manageMonthlyLink")}
                    </a>
                  ) : (
                    t.rich("manageMonthlyEmail", { email, link: mailLink })
                  )}
                </Bullet>
                <Bullet>
                  {t.rich("privacyLink", {
                    link: (chunks) => (
                      <Link
                        href={localizedHref(locale, "/privacy")}
                        className={linkClass}
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </Bullet>
              </ul>
            </aside>
          </Container>
        </section>
      ) : null,
    unavailable: () => (
      <section
        key="unavailable"
        aria-labelledby="support-giving"
        data-testid={`support-${view.kind}`}
        className="border-t border-beige bg-ivory py-14 md:py-20"
      >
        <Container className="max-w-3xl">
          <Card>
            <CardBody className="gap-5 p-6 sm:p-10">
              <span aria-hidden="true" className="gold-rule" />
              <h2
                id="support-giving"
                className="font-serif text-2xl font-semibold text-navy sm:text-3xl"
              >
                {view.kind === "not-configured"
                  ? t("notConfiguredTitle")
                  : t("closedTitle")}
              </h2>
              <p className="text-lg text-navy/85">
                {view.kind === "not-configured"
                  ? t("notConfiguredBody")
                  : t("closedBody")}
              </p>
              <p className="text-navy/85">
                {t.rich("emailUs", { email, link: mailLink })}
              </p>
              <h3 className="mt-2 font-serif text-xl font-semibold text-navy">
                {t("otherWaysTitle")}
              </h3>
              {otherWaysButtons}
            </CardBody>
          </Card>
        </Container>
      </section>
    ),
    // Online giving isn't open but Zelle/bank is: no "not set up yet" card.
    "other-ways": () => (
      <section
        key="other-ways"
        aria-labelledby="support-other-ways-title"
        data-testid="support-other-ways"
        className="border-t border-beige bg-ivory py-14 md:py-20"
      >
        <Container className="max-w-3xl">
          <Card>
            <CardBody className="gap-5 p-6 sm:p-10">
              <span aria-hidden="true" className="gold-rule" />
              <h2
                id="support-other-ways-title"
                className="font-serif text-2xl font-semibold text-navy sm:text-3xl"
              >
                {t("otherWaysTitle")}
              </h2>
              <p className="text-navy/85">
                {t.rich("emailUs", { email, link: mailLink })}
              </p>
              {otherWaysButtons}
            </CardBody>
          </Card>
        </Container>
      </section>
    ),
    offline: () =>
      offline ? (
        <OfflineGivingSection
          key="offline"
          giving={offline}
          locale={locale}
          email={email}
          taxNote={offlineTaxNote(locale, row.taxDeductibleVerified)}
        />
      ) : null,
  };

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("intro")}
      />

      <section
        aria-labelledby="support-info"
        data-testid="support-info"
        className="bg-cream py-14 md:py-20"
      >
        <Container className="flex max-w-3xl flex-col gap-5">
          {site.missionStatement ? (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border-l-4 border-gold bg-ivory px-6 py-5">
              <p className="text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase">
                {t("missionTitle")}
              </p>
              <p className="font-serif text-xl leading-relaxed text-navy italic">
                {site.missionStatement}
              </p>
            </div>
          ) : null}
          <Heading id="support-info">{t("howGiftsUsed")}</Heading>
          <span aria-hidden="true" className="gold-rule" />
          {givingInfo ? (
            <>
              <MarkdownContent
                markdown={givingInfo.text}
                lang={givingInfo.lang}
                className="text-lg"
              />
              {givingInfo.lang ? (
                <p className="text-sm text-navy/75">{t("englishOnly")}</p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gold/70 bg-ivory/70 px-5 py-4">
              <p className="text-lg text-navy/85 italic">
                {t("demoGivingInfo")}
              </p>
              <DemoBadge label={tCommon("demoBadge")} />
            </div>
          )}
        </Container>
      </section>

      {sections.map((s) => blocks[s]())}
    </>
  );
}
