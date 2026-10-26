import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { AppLocale } from "@/i18n/routing";
import { localizedHref } from "@/lib/i18n-path";

export async function CtaBand({ locale }: { locale: AppLocale }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section
      aria-labelledby="cta-band-title"
      className="bg-navy py-20 md:py-24"
    >
      <Container className="flex flex-col items-center gap-6 text-center">
        <span aria-hidden="true" className="gold-rule" />
        <h2
          id="cta-band-title"
          className="max-w-2xl font-serif text-3xl leading-tight font-semibold text-white sm:text-4xl"
        >
          {t("ctaBandTitle")}
        </h2>
        <p className="max-w-xl text-lg text-white/85">{t("ctaBandBody")}</p>
        <div className="mt-4 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            href={localizedHref(locale, "/support")}
            variant="gold"
            size="lg"
            className="focus-visible:outline-gold"
          >
            {t("ctaBandPrimary")}
          </Button>
          <Button
            href={localizedHref(locale, "/prayer")}
            variant="secondary"
            size="lg"
            className="border-white text-white hover:bg-white/10 focus-visible:outline-gold"
          >
            {t("ctaBandSecondary")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
