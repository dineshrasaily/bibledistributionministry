import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/public/LegalPage";
import { privacyPolicy } from "@/content/legal/privacy";
import { routing } from "@/i18n/routing";
import { localizedPageMetadata } from "@/lib/metadata";
import { getSiteSettings } from "@/lib/site-settings";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "privacy", "/privacy");
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const settings = await getSiteSettings();

  return (
    <LegalPage
      locale={locale}
      title={tMeta("privacy.title")}
      doc={privacyPolicy}
      values={{ name: settings.ministryName, email: settings.contactEmail }}
    />
  );
}
