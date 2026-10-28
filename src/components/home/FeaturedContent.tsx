import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardMeta, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SiteImage } from "@/components/ui/SiteImage";
import type { AppLocale } from "@/i18n/routing";
import type { FeaturedItem } from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative flex aspect-video items-center justify-center bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-deep)_100%)]">
      <div
        aria-hidden="true"
        className="absolute inset-3 rounded-sm border border-gold/30"
      />
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-gold/80 text-gold"
      >
        <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor">
          <path d="M8 5.5v13l10.5-6.5z" />
        </svg>
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export async function FeaturedContent({
  locale,
  items,
}: {
  locale: AppLocale;
  items: FeaturedItem[];
}) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tPost = await getTranslations({ locale, namespace: "PostTypes" });
  const tMedia = await getTranslations({ locale, namespace: "MediaKinds" });
  const format = await getFormatter({ locale });

  return (
    <section
      aria-labelledby="featured-title"
      className="bg-ivory py-20 md:py-28"
    >
      <Container className="flex flex-col gap-12">
        <SectionHeader
          id="featured-title"
          eyebrow={t("featuredEyebrow")}
          title={t("featuredTitle")}
          description={t("featuredDescription")}
        />
        {items.length === 0 ? (
          <EmptyState
            title={t("featuredEmptyTitle")}
            description={t("featuredEmptyDescription")}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((entry) => {
              const isMedia = entry.kind === "media";
              const { item } = entry;
              const summary =
                entry.kind === "media"
                  ? entry.item.description
                  : entry.item.excerpt;
              const href = localizedHref(
                locale,
                entry.kind === "media"
                  ? `/media#media-${entry.item.id}`
                  : `/devotionals/${entry.item.slug}`,
              );
              return (
                <li key={item.id} className="flex">
                  <Card as="article" className="w-full">
                    {entry.kind === "media" && entry.item.thumbnailUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden">
                        <SiteImage
                          src={entry.item.thumbnailUrl}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                      </div>
                    ) : isMedia ? (
                      <VideoPlaceholder label={tCommon("videoPlaceholder")} />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex aspect-video items-center justify-center bg-beige"
                      >
                        <span className="font-serif text-5xl text-gold-dark">
                          &ldquo;
                        </span>
                      </div>
                    )}
                    <CardBody>
                      <CardMeta>
                        <Badge>
                          {entry.kind === "media"
                            ? tMedia(entry.item.kind)
                            : tPost(entry.item.type)}
                        </Badge>
                        <time dateTime={item.publishedAt}>
                          {format.dateTime(new Date(item.publishedAt), {
                            dateStyle: "medium",
                          })}
                        </time>
                        {entry.kind === "media" &&
                        entry.item.durationMinutes != null ? (
                          <span>
                            {tCommon("minutes", {
                              count: entry.item.durationMinutes,
                            })}
                          </span>
                        ) : null}
                      </CardMeta>
                      <CardTitle>{item.title}</CardTitle>
                      {summary !== "" ? (
                        <p className="text-base text-navy/80">{summary}</p>
                      ) : null}
                      {entry.kind === "post" &&
                      entry.item.scriptureRefs.length > 0 ? (
                        <p className="text-sm font-medium text-gold-dark">
                          {entry.item.scriptureRefs.join(" · ")}
                        </p>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                        {item.isDemo ? (
                          <DemoBadge label={tCommon("demoBadge")} />
                        ) : null}
                        <Link
                          href={href}
                          className="rounded-sm text-sm font-semibold text-navy underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                        >
                          {isMedia ? tCommon("watch") : tCommon("readMore")}
                          <span className="sr-only">: {item.title}</span>
                        </Link>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </section>
  );
}
