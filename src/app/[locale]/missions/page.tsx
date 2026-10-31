import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EventCard } from "@/components/public/EventCard";
import { PageHero } from "@/components/public/PageHero";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing, type AppLocale } from "@/i18n/routing";
import { getMissions, type EventSummary } from "@/lib/content";
import { cn } from "@/lib/cn";
import { localizedPageMetadata } from "@/lib/metadata";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "missions", "/missions");
}

function EventList({
  id,
  title,
  events,
  empty,
  locale,
  className,
}: {
  id: string;
  title: string;
  events: EventSummary[];
  empty: { title: string; description: string };
  locale: AppLocale;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid={id}
      className={cn("py-14 md:py-20", className)}
    >
      <Container className="flex flex-col gap-10">
        <SectionHeader id={id} title={title} />
        {events.length === 0 ? (
          <EmptyState title={empty.title} description={empty.description} />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id} className="flex">
                <EventCard locale={locale} event={event} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}

export default async function MissionsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "Missions" });
  const { upcoming, completed } = await getMissions(locale);

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <EventList
        id="missions-upcoming"
        title={t("upcomingTitle")}
        events={upcoming}
        locale={locale}
        className="bg-cream"
        empty={{
          title: t("upcomingEmptyTitle"),
          description: t("upcomingEmptyDescription"),
        }}
      />
      <EventList
        id="missions-completed"
        title={t("completedTitle")}
        events={completed}
        locale={locale}
        className="bg-ivory"
        empty={{
          title: t("completedEmptyTitle"),
          description: t("completedEmptyDescription"),
        }}
      />
    </>
  );
}
