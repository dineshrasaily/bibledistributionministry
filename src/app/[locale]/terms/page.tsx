import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/public/LegalPage";
import { termsOfUse } from "@/content/legal/terms";
import { routing } from "@/i18n/routing";
import { donationTaxNote } from "@/lib/donation-wording";
import { localizedPageMetadata } from "@/lib/metadata";
import { getSiteSettings } from "@/lib/site-settings";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "terms", "/terms");
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const settings = await getSiteSettings();

  return (
    <LegalPage
      locale={locale}
      title={tMeta("terms.title")}
      doc={termsOfUse}
      values={{
        name: settings.ministryName,
        email: settings.contactEmail,
        taxNote: donationTaxNote(locale, settings.taxDeductibleVerified),
      }}
    />
  );
}
