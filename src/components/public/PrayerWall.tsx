import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { AppLocale } from "@/i18n/routing";
import type { PublicShareView } from "@/lib/content";

/**
 * Prayers and testimonies shared WITH PERMISSION: only admin-edited public
 * text, never the private request. Hidden when there is nothing to show.
 */
export async function PrayerWall({
  locale,
  items,
}: {
  locale: AppLocale;
  items: PublicShareView[];
}) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "PrayerPage" });
  const tKinds = await getTranslations({
    locale,
    namespace: "PublicShareKinds",
  });
  const date = new Intl.DateTimeFormat(locale === "ne" ? "ne-NP" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <section
      aria-labelledby="prayer-wall"
      data-testid="prayer-wall"
      className="border-t border-beige bg-ivory py-14 md:py-20"
    >
      <Container className="flex flex-col gap-10">
        <SectionHeader
          id="prayer-wall"
          eyebrow={t("wallEyebrow")}
          title={t("wallTitle")}
          description={t("wallIntro")}
        />
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card as="li" key={item.id} id={`share-${item.id}`}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.kind === "TESTIMONY" ? "gold" : "neutral"}
                  >
                    {tKinds(item.kind)}
                  </Badge>
                  <span className="text-sm text-navy/75">
                    {t("sharedOn", { date: date.format(item.publishedAt) })}
                  </span>
                </div>
                <p
                  lang={item.lang}
                  className="text-lg whitespace-pre-line text-navy/90"
                >
                  {item.text}
                </p>
              </CardBody>
            </Card>
          ))}
        </ul>
      </Container>
    </section>
  );
}
