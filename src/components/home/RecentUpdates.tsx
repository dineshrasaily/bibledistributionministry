import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardMeta, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";

export type UpdateCardItem = {
  id: string;
  title: string;
  excerpt: string;
  typeLabel: string;
  publishedAt: string;
  dateLabel: string;
  scriptureRefs: string[];
  isDemo: boolean;
};

export type RecentUpdatesLabels = {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  readMore: string;
  demoBadge: string;
};

/**
 * Presentational: data and translated labels come in via props so the
 * component is testable without next-intl.
 */
export function RecentUpdates({
  items,
  labels,
  readMoreHref,
}: {
  items: UpdateCardItem[];
  labels: RecentUpdatesLabels;
  readMoreHref: string;
}) {
  return (
    <section
      aria-labelledby="updates-title"
      className="bg-beige py-20 md:py-28"
    >
      <Container className="flex flex-col gap-12">
        <SectionHeader
          id="updates-title"
          tone="beige"
          eyebrow={labels.eyebrow}
          title={labels.title}
          description={labels.description}
        />
        {items.length === 0 ? (
          <EmptyState
            title={labels.emptyTitle}
            description={labels.emptyDescription}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id} className="flex">
                <Card as="article" className="w-full">
                  <CardBody>
                    <CardMeta>
                      <Badge>{item.typeLabel}</Badge>
                      <time dateTime={item.publishedAt}>{item.dateLabel}</time>
                    </CardMeta>
                    <CardTitle>{item.title}</CardTitle>
                    <p className="text-base text-navy/80">{item.excerpt}</p>
                    {item.scriptureRefs.length > 0 ? (
                      <p className="text-sm font-medium text-gold-dark">
                        {item.scriptureRefs.join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                      {item.isDemo ? (
                        <DemoBadge label={labels.demoBadge} />
                      ) : null}
                      <Link
                        href={readMoreHref}
                        className="rounded-sm text-sm font-semibold text-navy underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {labels.readMore}
                        <span className="sr-only">: {item.title}</span>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
