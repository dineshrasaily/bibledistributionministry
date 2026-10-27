import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { AppLocale } from "@/i18n/routing";
import type { EventSummary } from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";

export async function UpcomingEvents({
  locale,
  items,
}: {
  locale: AppLocale;
  items: EventSummary[];
}) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tKind = await getTranslations({ locale, namespace: "EventKinds" });
  const format = await getFormatter({ locale });

  return (
    <section aria-labelledby="events-title" className="bg-white py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          id="events-title"
          eyebrow={t("eventsEyebrow")}
          title={t("eventsTitle")}
          description={t("eventsDescription")}
        />
        {items.length === 0 ? (
          <EmptyState
            title={t("eventsEmptyTitle")}
            description={t("eventsEmptyDescription")}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((event) => {
              const date = new Date(event.startsAt);
              return (
                <li key={event.id} className="flex">
                  <Card as="article" className="w-full bg-ivory">
                    <CardBody className="gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          aria-hidden="true"
                          className="flex w-16 shrink-0 flex-col items-center rounded-md border border-gold/60 bg-white py-2 text-navy"
                        >
                          <span className="text-xs font-semibold tracking-[0.12em] uppercase">
                            {format.dateTime(date, { month: "short" })}
                          </span>
                          <span className="font-serif text-2xl leading-tight font-semibold">
                            {format.dateTime(date, { day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                          <Badge className="w-fit">{tKind(event.kind)}</Badge>
                          <time
                            dateTime={event.startsAt}
                            className="text-sm text-navy/80"
                          >
                            {format.dateTime(date, {
                              dateStyle: "full",
                            })}
                          </time>
                        </div>
                      </div>
                      <CardTitle>{event.title}</CardTitle>
                      <p className="flex items-start gap-2 text-base text-navy/80">
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
                        {event.location}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                        {event.isDemo ? (
                          <DemoBadge label={tCommon("demoBadge")} />
                        ) : null}
                        <Link
                          href={localizedHref(
                            locale,
                            `/missions/${event.slug}`,
                          )}
                          className="rounded-sm text-sm font-semibold text-navy underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                        >
                          {tCommon("eventDetails")}
                          <span className="sr-only">: {event.title}</span>
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
