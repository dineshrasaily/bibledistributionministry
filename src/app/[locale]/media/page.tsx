import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import type { ReactNode } from "react";
import { AudioPlayer } from "@/components/public/AudioPlayer";
import { PageHero } from "@/components/public/PageHero";
import { PhotoGallery } from "@/components/public/PhotoGallery";
import { YouTubeFacade } from "@/components/public/YouTubeFacade";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardMeta, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing, type AppLocale } from "@/i18n/routing";
import { getMediaCenter, type MediaView } from "@/lib/content";
import { cn } from "@/lib/cn";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "media", "/media");
}

function VideoUnavailable({ label }: { label: string }) {
  return (
    <div className="relative flex aspect-video items-center justify-center bg-[linear-gradient(135deg,var(--color-navy)_0%,var(--color-navy-deep)_100%)]">
      <div
        aria-hidden="true"
        className="absolute inset-3 rounded-sm border border-gold/30"
      />
      <p className="relative rounded-full border border-gold/70 px-4 py-1.5 text-sm font-medium text-white">
        {label}
      </p>
    </div>
  );
}

async function MediaCard({
  locale,
  item,
}: {
  locale: AppLocale;
  item: MediaView;
}) {
  const t = await getTranslations({ locale, namespace: "MediaCenter" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tKind = await getTranslations({ locale, namespace: "MediaKinds" });
  const tVideo = await getTranslations({ locale, namespace: "Video" });
  const format = await getFormatter({ locale });
  const isAudio = item.type === "AUDIO";

  return (
    <Card
      as="article"
      id={`media-${item.id}`}
      className="w-full scroll-mt-24"
      data-testid="media-card"
    >
      {item.type === "VIDEO_EMBED" ? (
        item.embedUrl ? (
          <YouTubeFacade
            embedUrl={item.embedUrl}
            title={item.title}
            thumbnailUrl={item.thumbnailUrl}
            playLabel={tVideo("play", { title: item.title })}
          />
        ) : (
          <VideoUnavailable label={t("videoUnavailable")} />
        )
      ) : null}
      <CardBody>
        <CardMeta>
          <Badge>{tKind(item.kind)}</Badge>
          <time dateTime={item.publishedAt}>
            {format.dateTime(new Date(item.publishedAt), {
              dateStyle: "medium",
              timeZone: "UTC",
            })}
          </time>
          {item.durationMinutes != null ? (
            <span>{tCommon("minutes", { count: item.durationMinutes })}</span>
          ) : null}
        </CardMeta>
        <CardTitle>{item.title}</CardTitle>
        {item.description !== "" ? (
          <p className="text-base text-navy/80">{item.description}</p>
        ) : null}
        {isAudio ? (
          item.audioUrl ? (
            <AudioPlayer
              src={item.audioUrl}
              title={item.title}
              fallback={t("audioUnavailable")}
            />
          ) : (
            <p className="text-sm font-medium text-navy/80">
              {t("audioUnavailable")}
            </p>
          )
        ) : null}
        {item.isDemo ? (
          <div className="mt-auto pt-2">
            <DemoBadge label={tCommon("demoBadge")} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function MediaSection({
  id,
  title,
  note,
  emptyLabel,
  className,
  children,
  isEmpty,
}: {
  id: string;
  title: string;
  note?: string;
  emptyLabel: string;
  className?: string;
  children: ReactNode;
  isEmpty: boolean;
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid={id}
      className={cn("py-14 md:py-20", className)}
    >
      <Container className="flex flex-col gap-8">
        <SectionHeader id={id} title={title} description={note} />
        {isEmpty ? <EmptyState title={emptyLabel} /> : children}
      </Container>
    </section>
  );
}

export default async function MediaPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "MediaCenter" });
  const tVideo = await getTranslations({ locale, namespace: "Video" });
  const tLightbox = await getTranslations({ locale, namespace: "Lightbox" });
  const center = await getMediaCenter(locale);
  const empty = t("emptySection");
  const galleryLabels = {
    close: tLightbox("close"),
    previous: tLightbox("previous"),
    next: tLightbox("next"),
    counter: tLightbox.raw("counter") as string,
    hint: tLightbox("hint"),
  };

  const lists = [
    { key: "sermons", items: center.sermons, note: tVideo("privacyNote") },
    { key: "videos", items: center.videos, note: tVideo("privacyNote") },
  ] as const;

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      {lists.map((list, i) => (
        <MediaSection
          key={list.key}
          id={`media-${list.key}`}
          title={t(list.key)}
          note={"note" in list ? list.note : undefined}
          emptyLabel={empty}
          isEmpty={list.items.length === 0}
          className={i % 2 === 0 ? "bg-white" : "bg-ivory"}
        >
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((item) => (
              <li key={item.id} className="flex">
                <MediaCard locale={locale} item={item} />
              </li>
            ))}
          </ul>
        </MediaSection>
      ))}
      <MediaSection
        id="media-galleries"
        title={t("galleries")}
        emptyLabel={empty}
        isEmpty={center.galleries.length === 0}
        className="bg-white"
      >
        <div className="flex flex-col gap-12">
          {center.galleries.map((group) => {
            const groupId = `gallery-${group.id}`;
            return (
              <section
                key={groupId}
                aria-labelledby={groupId}
                className="flex flex-col gap-4"
                data-testid="photo-group"
              >
                <div className="flex flex-col gap-1">
                  <h3
                    id={groupId}
                    className="font-serif text-xl font-semibold text-navy"
                  >
                    {group.id === "other" ? t("otherPhotos") : group.title}
                  </h3>
                  {group.event ? (
                    <p className="text-base text-navy/80">
                      <Link
                        href={localizedHref(
                          locale,
                          `/missions/${group.event.slug}`,
                        )}
                        className="rounded-sm text-gold-dark underline decoration-gold underline-offset-4 hover:decoration-2"
                      >
                        {t("fromEvent", { title: group.event.title })}
                      </Link>
                    </p>
                  ) : null}
                  {group.description ? (
                    <p
                      lang={group.description.lang}
                      className="max-w-prose text-base text-navy/80"
                    >
                      {group.description.text}
                    </p>
                  ) : null}
                </div>
                <PhotoGallery
                  photos={group.items.map((m) => ({
                    id: m.id,
                    url: m.image!.url,
                    alt: m.image!.alt,
                    caption: m.title,
                    width: m.width,
                    height: m.height,
                    openLabel: tLightbox("open", { alt: m.image!.alt }),
                  }))}
                  labels={galleryLabels}
                />
              </section>
            );
          })}
        </div>
      </MediaSection>
    </>
  );
}
