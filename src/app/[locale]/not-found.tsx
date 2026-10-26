import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { localizedHref } from "@/lib/i18n-path";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();

  return (
    <section className="py-20 md:py-28">
      <Container className="flex flex-col items-center gap-6 text-center">
        <SectionHeader
          as="h1"
          align="center"
          eyebrow="404"
          title={t("title")}
        />
        <p className="max-w-xl text-lg text-navy/85">{t("body")}</p>
        <Link
          href={localizedHref(locale, "/")}
          className="mt-2 rounded-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
        >
          {t("backHome")}
        </Link>
      </Container>
    </section>
  );
}
