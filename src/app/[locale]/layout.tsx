import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";
import { getSiteConfig } from "@/config/site";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { getSiteSettings } from "@/lib/site-settings";
import { inter, lora, notoSansDeva, notoSerifDeva } from "../fonts";
import "../globals.css";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const site = getSiteConfig();
  const { ministryName: name, isDemo } = await getSiteSettings();

  return {
    metadataBase: new URL(site.siteUrl),
    title: { default: name, template: `%s | ${name}` },
    description: isDemo
      ? t("siteDescription")
      : t("siteDescriptionPlain", { name }),
    applicationName: name,
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const tSkip = await getTranslations({ locale, namespace: "SkipLink" });
  const tBanner = await getTranslations({ locale, namespace: "DemoBanner" });
  const { isDemo } = await getSiteSettings();

  return (
    <html
      lang={locale}
      className={cn(
        lora.variable,
        inter.variable,
        locale === "ne" && [notoSansDeva.variable, notoSerifDeva.variable],
      )}
    >
      <body className="flex min-h-dvh flex-col bg-ivory text-navy antialiased">
        <NextIntlClientProvider>
          <SkipLink label={tSkip("label")} />
          {isDemo ? <DemoBanner text={tBanner("text")} /> : null}
          <Header locale={locale} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 focus:outline-none"
          >
            {children}
          </main>
          <Footer locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
