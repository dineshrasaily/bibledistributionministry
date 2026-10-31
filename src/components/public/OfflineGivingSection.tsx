import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/public/CopyButton";
import {
  SupportBullet,
  supportLinkClass,
} from "@/components/public/SupportBullet";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SiteImage } from "@/components/ui/SiteImage";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { localizedHref } from "@/lib/i18n-path";
import type { OfflineGiving } from "@/lib/offline-giving";

type CopyLabels = { copy: string; copied: string; failed: string };

/** One label/value row; `copy` adds an accessible Copy button. */
function DetailRow({
  label,
  value,
  copy,
  mono = false,
  multiline = false,
}: {
  label: string;
  value: string;
  copy?: { label: string; labels: CopyLabels };
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-beige/70 py-3 last:border-0">
      <dt className="text-sm font-semibold tracking-wide text-gold-dark">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span
          className={cn(
            "min-w-0 text-lg break-all text-navy",
            mono && "font-mono tracking-wide",
            multiline && "break-words whitespace-pre-line",
          )}
        >
          {value}
        </span>
        {copy ? (
          <CopyButton value={value} label={copy.label} labels={copy.labels} />
        ) : null}
      </dd>
    </div>
  );
}

/** "Give by Zelle or bank transfer" on the Support page (server component). */
export async function OfflineGivingSection({
  giving,
  locale,
  email,
  taxNote,
}: {
  giving: OfflineGiving;
  locale: AppLocale;
  email: string;
  taxNote: string;
}) {
  const t = await getTranslations({ locale, namespace: "SupportPage" });
  const { zelle, bank, note } = giving;
  const labels: CopyLabels = {
    copy: t("copy"),
    copied: t("copied"),
    failed: t("copyFailed"),
  };
  const copyOf = (field: string) => ({
    label: t("copyLabel", { field }),
    labels,
  });
  const mailLink = (chunks: ReactNode) => (
    <a href={`mailto:${email}`} className={cn(supportLinkClass, "break-all")}>
      {chunks}
    </a>
  );

  return (
    <section
      aria-labelledby="support-offline-title"
      data-testid="support-offline"
      className="border-t border-beige bg-cream py-14 md:py-20"
    >
      <Container className="flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h2
            id="support-offline-title"
            className="font-serif text-3xl leading-tight font-semibold text-navy sm:text-4xl"
          >
            {t("offlineTitle")}
          </h2>
          <span aria-hidden="true" className="gold-rule" />
          <p className="text-lg text-navy/85">{t("offlineIntro")}</p>
        </header>

        <div className={cn("grid gap-6", zelle && bank && "md:grid-cols-2")}>
          {zelle ? (
            <Card data-testid="support-zelle">
              <CardBody className="gap-5 p-5 sm:p-8">
                <h3 className="font-serif text-2xl font-semibold text-navy">
                  {t("zelleTitle")}
                </h3>
                <dl className="flex flex-col">
                  <DetailRow
                    label={t("zelleRecipientLabel")}
                    value={zelle.recipientName}
                  />
                  {zelle.email ? (
                    <DetailRow
                      label={t("zelleEmailLabel")}
                      value={zelle.email}
                      copy={copyOf(t("zelleEmailLabel"))}
                    />
                  ) : null}
                  {zelle.phone ? (
                    <DetailRow
                      label={t("zellePhoneLabel")}
                      value={zelle.phone}
                      copy={copyOf(t("zellePhoneLabel"))}
                    />
                  ) : null}
                </dl>
                {zelle.qr ? (
                  <figure className="flex flex-col items-center gap-3">
                    <div className="rounded-lg border border-beige bg-white p-3">
                      <div className="relative size-48 sm:size-56">
                        <SiteImage
                          src={zelle.qr.url}
                          alt={zelle.qr.alt}
                          fill
                          sizes="224px"
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <figcaption className="text-center text-sm text-navy/80">
                      {t("zelleQrCaption")}
                    </figcaption>
                  </figure>
                ) : null}
                <div className="flex flex-col gap-2">
                  <h4 className="font-serif text-lg font-semibold text-navy">
                    {t("zelleStepsTitle")}
                  </h4>
                  <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-navy/85 marker:font-semibold marker:text-gold-dark">
                    <li>{t("zelleStep1")}</li>
                    <li>{t("zelleStep2")}</li>
                    <li className="break-words">
                      {t("zelleStep3", { name: zelle.recipientName })}
                    </li>
                  </ol>
                </div>
                <p
                  role="note"
                  className="rounded-r-lg border-l-4 border-gold-dark bg-ivory px-4 py-3 text-sm text-navy"
                >
                  <span className="font-semibold">{t("zelleSafetyTitle")}</span>{" "}
                  {t("zelleSafetyBody")}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {bank ? (
            <Card data-testid="support-bank">
              <CardBody className="gap-5 p-5 sm:p-8">
                <h3 className="font-serif text-2xl font-semibold text-navy">
                  {t("bankTitle")}
                </h3>
                <dl className="flex flex-col">
                  {bank.bankName ? (
                    <DetailRow
                      label={t("bankNameLabel")}
                      value={bank.bankName}
                    />
                  ) : null}
                  {bank.accountName ? (
                    <DetailRow
                      label={t("bankAccountNameLabel")}
                      value={bank.accountName}
                    />
                  ) : null}
                  {bank.details?.accountNumber ? (
                    <DetailRow
                      label={t("bankAccountNumberLabel")}
                      value={bank.details.accountNumber}
                      copy={copyOf(t("bankAccountNumberLabel"))}
                      mono
                    />
                  ) : null}
                  {bank.details?.routingNumber ? (
                    <DetailRow
                      label={t("bankRoutingLabel")}
                      value={bank.details.routingNumber}
                      copy={copyOf(t("bankRoutingLabel"))}
                      mono
                    />
                  ) : null}
                  {bank.details?.swiftCode ? (
                    <DetailRow
                      label={t("bankSwiftLabel")}
                      value={bank.details.swiftCode}
                      copy={copyOf(t("bankSwiftLabel"))}
                      mono
                    />
                  ) : null}
                  {bank.address ? (
                    <DetailRow
                      label={t("bankAddressLabel")}
                      value={bank.address}
                      multiline
                    />
                  ) : null}
                </dl>
                {bank.details ? null : (
                  <p
                    data-testid="bank-contact-for-details"
                    className="rounded-lg border border-beige bg-ivory px-4 py-3 text-navy/85"
                  >
                    {t.rich("bankContactForDetails", {
                      link: (chunks) => (
                        <Link
                          href={localizedHref(locale, "/contact")}
                          className={supportLinkClass}
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        {note ? (
          <div
            data-testid="support-offline-note"
            className="flex flex-col gap-2 rounded-lg border-l-4 border-gold bg-ivory px-6 py-5"
          >
            <p className="text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase">
              {t("offlineNoteTitle")}
            </p>
            <p
              lang={note.textLang}
              className="text-lg break-words whitespace-pre-line text-navy"
            >
              {note.text}
            </p>
            {note.textLang ? (
              <p className="text-sm text-navy/75">{t("englishOnly")}</p>
            ) : null}
          </div>
        ) : null}

        <aside
          aria-labelledby="support-offline-about"
          data-testid="support-offline-disclosure"
          className="flex flex-col gap-4 rounded-lg border border-beige bg-ivory p-6 sm:p-8"
        >
          <h3
            id="support-offline-about"
            className="font-serif text-2xl font-semibold text-navy"
          >
            {t("offlineAboutTitle")}
          </h3>
          <span aria-hidden="true" className="gold-rule" />
          <ul className="flex flex-col gap-4">
            <SupportBullet>{t("offlineDirectNote")}</SupportBullet>
            <SupportBullet>{t("offlineNotProcessedNote")}</SupportBullet>
            <SupportBullet>
              {t.rich("offlineReceiptNote", { email, link: mailLink })}
            </SupportBullet>
            <SupportBullet>
              <span data-testid="support-offline-tax-note">{taxNote}</span>
            </SupportBullet>
          </ul>
        </aside>
      </Container>
    </section>
  );
}
