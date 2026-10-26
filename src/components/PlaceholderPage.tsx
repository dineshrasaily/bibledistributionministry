import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DemoBadge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";
import type { PageKey } from "@/lib/metadata";
import { getLocalizedSiteSettings } from "@/lib/site-settings";

/** Simple page shell for routes that are built in a later phase. */
export async function PlaceholderPage({
  locale,
  pageKey,
  showEmail = false,
}: {
  locale: AppLocale;
  pageKey: Exclude<PageKey, "home">;
  showEmail?: boolean;
}) {
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const t = await getTranslations({ locale, namespace: "Placeholder" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const site = await getLocalizedSiteSettings(locale);

  return (
    <section className="bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,var(--color-beige)_0%,transparent_70%)] py-20 md:py-28">
      <Container className="flex flex-col items-center gap-6 text-center">
        <SectionHeader
          as="h1"
          align="center"
          eyebrow={tCommon("comingSoon")}
          title={tMeta(`${pageKey}.title`)}
        />
        <p className="max-w-xl text-lg text-navy/85">{t("body")}</p>
        {showEmail ? (
          <p className="text-navy/85">
            {t("emailNote")}{" "}
            <span className="font-medium text-navy">{site.contactEmail}</span>
          </p>
        ) : null}
        <DemoBadge label={tCommon("demoBadge")} />
        <Link
          href={localizedHref(locale, "/")}
          className="mt-4 rounded-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
        >
          {t("backHome")}
        </Link>
      </Container>
    </section>
  );
}
