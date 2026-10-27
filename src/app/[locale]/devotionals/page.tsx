import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeaturedVerse } from "@/components/home/FeaturedVerse";
import { PageHero } from "@/components/public/PageHero";
import { PostCard } from "@/components/public/PostCard";
import { PostFilters } from "@/components/public/PostFilters";
import { PublicPagination } from "@/components/public/PublicPagination";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostType } from "@/generated/prisma/enums";
import { routing } from "@/i18n/routing";
import {
  getFeaturedVerse,
  listPublicCategories,
  listPublishedPosts,
} from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";
import {
  hasPublicPostFilters,
  parsePublicPostQuery,
} from "@/lib/validation/public-query";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Canonical stays /devotionals (filters and pages are not separate pages).
export function generateMetadata({ params }: Pick<PageProps, "params">) {
  return localizedPageMetadata(params, "devotionals", "/devotionals");
}

export default async function DevotionalsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parsePublicPostQuery(await searchParams);
  const [verse, posts, categories] = await Promise.all([
    getFeaturedVerse(),
    listPublishedPosts(query, locale),
    listPublicCategories(locale),
  ]);

  const t = await getTranslations({ locale, namespace: "Devotionals" });
  const tPost = await getTranslations({ locale, namespace: "PostTypes" });
  const tPage = await getTranslations({ locale, namespace: "Pagination" });
  const base = localizedHref(locale, "/devotionals");
  const filtered = hasPublicPostFilters(query);

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      {verse ? <FeaturedVerse locale={locale} verse={verse} /> : null}

      <section
        aria-labelledby="results-heading"
        className="bg-ivory py-14 md:py-20"
      >
        <Container className="flex flex-col gap-8">
          <PostFilters
            action={base}
            query={query}
            types={Object.values(PostType).map((value) => ({
              value,
              label: tPost(value),
            }))}
            categories={categories.map((c) => ({
              value: c.slug,
              label: c.name,
            }))}
            labels={{
              heading: t("filtersHeading"),
              search: t("searchLabel"),
              searchPlaceholder: t("searchPlaceholder"),
              type: t("typeLabel"),
              allTypes: t("allTypes"),
              category: t("categoryLabel"),
              allCategories: t("allCategories"),
              apply: t("apply"),
              clear: t("clear"),
            }}
          />

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id="results-heading"
              className="font-serif text-2xl font-semibold text-navy"
            >
              {t("resultsHeading")}
            </h2>
            <p
              role="status"
              className="text-sm text-navy/80"
              data-testid="results-count"
            >
              {t("resultsCount", { count: posts.total })}
            </p>
          </div>

          {posts.items.length === 0 ? (
            filtered ? (
              <EmptyState
                title={t("noMatchTitle")}
                description={t("noMatchDescription")}
              />
            ) : (
              <EmptyState
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            )
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.items.map((post) => (
                <li key={post.id} className="flex">
                  <PostCard locale={locale} post={post} />
                </li>
              ))}
            </ul>
          )}

          <PublicPagination
            base={base}
            query={query}
            page={posts.page}
            pageCount={posts.pageCount}
            labels={{
              label: tPage("label"),
              previous: tPage("previous"),
              next: tPage("next"),
              pageOf: tPage("pageOf", {
                page: posts.page,
                count: posts.pageCount,
              }),
            }}
          />
        </Container>
      </section>
    </>
  );
}
