import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { PinIcon } from "@/components/public/EventCard";
import { PhotoGallery } from "@/components/public/PhotoGallery";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { SiteImage } from "@/components/ui/SiteImage";
import { routing } from "@/i18n/routing";
import { getPublishedEventBySlug, getPublishedSlugs } from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";
import { localizedDetailMetadata } from "@/lib/metadata";
import { SLUG_RE } from "@/lib/validation/common";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const { events } = await getPublishedSlugs();
  return events.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !SLUG_RE.test(slug)) return {};
  const event = await getPublishedEventBySlug(slug, locale);
  if (!event) return {};
  const format = await getFormatter({ locale });
  const date = format.dateTime(new Date(event.startsAt), {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return localizedDetailMetadata({
    locale,
    path: `/missions/${slug}`,
    title: event.title,
    description: [date, event.location].filter(Boolean).join(" · "),
    images: event.coverImageUrl ? [event.coverImageUrl] : undefined,
  });
}

const headingClass =
  "font-serif text-2xl leading-tight font-semibold text-navy sm:text-3xl";

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!SLUG_RE.test(slug)) notFound();
  setRequestLocale(locale);

  const event = await getPublishedEventBySlug(slug, locale);
  if (!event) notFound();

  const t = await getTranslations({ locale, namespace: "EventDetail" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tKind = await getTranslations({ locale, namespace: "EventKinds" });
  const tStatus = await getTranslations({ locale, namespace: "EventStatuses" });
  const tLightbox = await getTranslations({ locale, namespace: "Lightbox" });
  const format = await getFormatter({ locale });
  const listHref = localizedHref(locale, "/missions");
  const start = new Date(event.startsAt);
  const utc = { dateStyle: "full", timeZone: "UTC" } as const;
  const when = event.endsAt
    ? format.dateTimeRange(start, new Date(event.endsAt), utc)
    : format.dateTime(start, utc);

  return (
    <article className="bg-ivory pb-16 md:pb-24" data-testid="event-detail">
      <header className="bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,var(--color-beige)_0%,transparent_75%)] pt-12 pb-10 md:pt-20">
        <Container className="flex max-w-3xl flex-col gap-5">
          <Link
            href={listHref}
            className="w-fit rounded-sm text-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
          >
            <span aria-hidden="true">←&nbsp;</span>
            {t("backToList")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{tKind(event.kind)}</Badge>
            <Badge variant={event.status === "UPCOMING" ? "navy" : "neutral"}>
              {tStatus(event.status)}
            </Badge>
            {event.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null}
          </div>
          <h1 className="font-serif text-4xl leading-tight font-semibold text-navy sm:text-5xl">
            {event.title}
          </h1>
          <span aria-hidden="true" className="gold-rule" />
          <dl className="grid gap-4 rounded-lg border border-beige bg-white p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold tracking-[0.16em] text-gold-dark uppercase">
                {t("when")}
              </dt>
              <dd className="mt-1 text-navy">
                <time dateTime={event.startsAt}>{when}</time>
              </dd>
            </div>
            {event.location !== "" ? (
              <div>
                <dt className="text-xs font-semibold tracking-[0.16em] text-gold-dark uppercase">
                  {t("where")}
                </dt>
                <dd className="mt-1 flex items-start gap-2 text-navy">
                  <PinIcon />
                  {event.location}
                </dd>
              </div>
            ) : null}
          </dl>
        </Container>
      </header>

      <Container className="flex max-w-3xl flex-col gap-12">
        {event.status === "CANCELLED" ? (
          <p
            role="note"
            className="rounded-lg border-2 border-red-700 bg-white px-5 py-4 font-semibold text-red-700"
          >
            {t("cancelledNotice")}
          </p>
        ) : null}

        {event.coverImageUrl ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <SiteImage
              src={event.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        {event.description ? (
          <section
            aria-labelledby="event-about"
            className="flex flex-col gap-4"
          >
            <h2 id="event-about" className={headingClass}>
              {t("about")}
            </h2>
            <MarkdownContent
              markdown={event.description.text}
              lang={event.description.lang}
              className="text-lg"
            />
          </section>
        ) : null}

        {event.volunteerInfo ? (
          <section
            aria-labelledby="event-volunteer"
            data-testid="event-volunteer"
            className="flex flex-col gap-4 rounded-lg border border-gold/60 bg-white p-6"
          >
            <h2 id="event-volunteer" className={headingClass}>
              {t("volunteer")}
            </h2>
            <div
              lang={event.volunteerInfo.lang}
              className="flex flex-col gap-3"
            >
              {event.volunteerInfo.paragraphs.map((p, i) => (
                <p key={i} className="text-lg text-navy/85">
                  {p}
                </p>
              ))}
            </div>
            <Link
              href={localizedHref(locale, "/contact")}
              className="w-fit rounded-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
            >
              {t("volunteerContact")}
            </Link>
          </section>
        ) : null}

        {event.report ? (
          <section
            aria-labelledby="event-report"
            data-testid="event-report"
            className="flex flex-col gap-4"
          >
            <h2 id="event-report" className={headingClass}>
              {t("report")}
            </h2>
            <MarkdownContent
              markdown={event.report.text}
              lang={event.report.lang}
              className="text-lg"
            />
          </section>
        ) : null}

        <section
          aria-labelledby="event-gallery"
          data-testid="event-gallery"
          className="flex flex-col gap-4"
        >
          <h2 id="event-gallery" className={headingClass}>
            {t("gallery")}
          </h2>
          {event.gallery.length > 0 ? (
            <PhotoGallery
              photos={event.gallery.map((m) => ({
                id: m.id,
                url: m.image!.url,
                alt: m.image!.alt,
                caption: m.title,
                width: m.width,
                height: m.height,
                openLabel: tLightbox("open", { alt: m.image!.alt }),
              }))}
              labels={{
                close: tLightbox("close"),
                previous: tLightbox("previous"),
                next: tLightbox("next"),
                counter: tLightbox.raw("counter") as string,
                hint: tLightbox("hint"),
              }}
            />
          ) : (
            <p className="text-navy/80">{t("galleryEmpty")}</p>
          )}
        </section>

        <div className="flex flex-col gap-3 border-t border-beige pt-8 sm:flex-row">
          <Button href={localizedHref(locale, "/prayer")}>
            {t("ctaPrayer")}
          </Button>
          <Button href={listHref} variant="secondary">
            {t("backToList")}
          </Button>
        </div>
      </Container>
    </article>
  );
}
