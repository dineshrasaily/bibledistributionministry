import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { CtaBand } from "@/components/home/CtaBand";
import { FeaturedContent } from "@/components/home/FeaturedContent";
import { FeaturedVerse } from "@/components/home/FeaturedVerse";
import { Hero } from "@/components/home/Hero";
import { MinistryIntro } from "@/components/home/MinistryIntro";
import { RecentUpdates } from "@/components/home/RecentUpdates";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { routing } from "@/i18n/routing";
import {
  getFeaturedContent,
  getFeaturedVerse,
  getRecentUpdates,
  getUpcomingEvents,
} from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";

type PageProps = { params: Promise<{ locale: string }> };

// Lets the UTC "verse of the day" roll over without an admin edit.
export const revalidate = 3600;

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "home", "/");
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [updates, featured, events, verse] = await Promise.all([
    getRecentUpdates(locale),
    getFeaturedContent(locale),
    getUpcomingEvents(locale),
    getFeaturedVerse(),
  ]);

  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tPost = await getTranslations({ locale, namespace: "PostTypes" });
  const format = await getFormatter({ locale });

  return (
    <>
      <Hero locale={locale} />
      {verse ? <FeaturedVerse locale={locale} verse={verse} /> : null}
      <MinistryIntro locale={locale} />
      <RecentUpdates
        readMoreHref={localizedHref(locale, "/devotionals")}
        items={updates.map((post) => ({
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          typeLabel: tPost(post.type),
          publishedAt: post.publishedAt,
          dateLabel: format.dateTime(new Date(post.publishedAt), {
            dateStyle: "medium",
          }),
          scriptureRefs: post.scriptureRefs,
          isDemo: post.isDemo,
        }))}
        labels={{
          eyebrow: t("updatesEyebrow"),
          title: t("updatesTitle"),
          description: t("updatesDescription"),
          emptyTitle: t("updatesEmptyTitle"),
          emptyDescription: t("updatesEmptyDescription"),
          readMore: tCommon("readMore"),
          demoBadge: tCommon("demoBadge"),
        }}
      />
      <FeaturedContent locale={locale} items={featured} />
      <UpcomingEvents locale={locale} items={events} />
      <CtaBand locale={locale} />
    </>
  );
}
