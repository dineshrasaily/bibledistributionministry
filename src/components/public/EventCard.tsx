import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import type { AppLocale } from "@/i18n/routing";
import type { EventSummary } from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";

export function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-1 size-4 shrink-0 text-gold-dark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

/** Card linking to /missions/[slug]. */
export async function EventCard({
  locale,
  event,
}: {
  locale: AppLocale;
  event: EventSummary;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tKind = await getTranslations({ locale, namespace: "EventKinds" });
  const t = await getTranslations({ locale, namespace: "Missions" });
  const format = await getFormatter({ locale });
  const date = new Date(event.startsAt);
  const utc = { timeZone: "UTC" } as const;

  return (
    <Card as="article" className="w-full bg-ivory" data-testid="event-card">
      {event.coverImageUrl ? (
        // TODO(Phase 7): next/image + Blob
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverImageUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : null}
      <CardBody className="gap-4">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex w-16 shrink-0 flex-col items-center rounded-md border border-gold/60 bg-white py-2 text-navy"
          >
            <span className="text-xs font-semibold tracking-[0.12em] uppercase">
              {format.dateTime(date, { month: "short", ...utc })}
            </span>
            <span className="font-serif text-2xl leading-tight font-semibold">
              {format.dateTime(date, { day: "numeric", ...utc })}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Badge className="w-fit">{tKind(event.kind)}</Badge>
            <time dateTime={event.startsAt} className="text-sm text-navy/80">
              {format.dateTime(date, { dateStyle: "full", ...utc })}
            </time>
          </div>
        </div>
        <CardTitle>{event.title}</CardTitle>
        {event.location !== "" ? (
          <p className="flex items-start gap-2 text-base text-navy/80">
            <PinIcon />
            {event.location}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          {event.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null}
          <Link
            href={localizedHref(locale, `/missions/${event.slug}`)}
            className="rounded-sm text-sm font-semibold text-navy underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
          >
            {t("viewDetails")}
            <span className="sr-only">: {event.title}</span>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
