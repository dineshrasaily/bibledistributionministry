import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { ScripturePanel } from "@/components/public/ScripturePanel";
import { ShareButtons } from "@/components/public/ShareButtons";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { SiteImage } from "@/components/ui/SiteImage";
import { getSiteConfig } from "@/config/site";
import { routing } from "@/i18n/routing";
import {
  getPublishedPostBySlug,
  getPublishedSlugs,
  getVersesByReferences,
} from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";
import { localizedDetailMetadata } from "@/lib/metadata";
import { SLUG_RE } from "@/lib/validation/common";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const { posts } = await getPublishedSlugs();
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !SLUG_RE.test(slug)) return {};
  const post = await getPublishedPostBySlug(slug, locale);
  if (!post) return {};
  return localizedDetailMetadata({
    locale,
    path: `/devotionals/${slug}`,
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
  });
}

const backLinkClass =
  "rounded-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2";

export default async function PostDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!SLUG_RE.test(slug)) notFound();
  setRequestLocale(locale);

  const post = await getPublishedPostBySlug(slug, locale);
  if (!post) notFound();
  const verses = await getVersesByReferences(post.scriptureRefs);

  const t = await getTranslations({ locale, namespace: "PostDetail" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tPost = await getTranslations({ locale, namespace: "PostTypes" });
  const format = await getFormatter({ locale });
  const listHref = localizedHref(locale, "/devotionals");
  const url = `${getSiteConfig().siteUrl.replace(/\/$/, "")}${localizedHref(locale, `/devotionals/${post.slug}`)}`;

  return (
    <article className="bg-ivory pb-16 md:pb-24" data-testid="post-detail">
      <header className="bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,var(--color-beige)_0%,transparent_75%)] pt-12 pb-10 md:pt-20">
        <Container className="flex max-w-3xl flex-col gap-5">
          <Link href={listHref} className={`${backLinkClass} w-fit text-sm`}>
            <span aria-hidden="true">←&nbsp;</span>
            {t("backToList")}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-navy/80">
            <Badge>{tPost(post.type)}</Badge>
            <span>
              {t("publishedOn")}{" "}
              <time dateTime={post.publishedAt}>
                {format.dateTime(new Date(post.publishedAt), {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </time>
            </span>
            {post.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null}
          </div>
          <h1 className="font-serif text-4xl leading-tight font-semibold text-navy sm:text-5xl">
            {post.title}
          </h1>
          <span aria-hidden="true" className="gold-rule" />
          {post.categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-navy/80">
                {t("categories")}:
              </span>
              <ul className="flex flex-wrap gap-2">
                {post.categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`${listHref}?category=${encodeURIComponent(c.slug)}`}
                      className="inline-flex min-h-8 items-center rounded-full border border-gold-dark bg-white px-3 text-xs font-medium text-gold-dark hover:bg-beige/60"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Container>
      </header>

      <Container className="flex max-w-3xl flex-col gap-10">
        {post.coverImageUrl ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <SiteImage
              src={post.coverImageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        {post.scriptureRefs.length > 0 ? (
          <ScripturePanel
            refs={post.scriptureRefs}
            verses={verses}
            heading={t("scriptureHeading")}
            note={locale === "ne" ? t("scriptureNoteNe") : undefined}
          />
        ) : null}

        <div className="flex flex-col gap-4">
          {post.body !== "" ? (
            <>
              {post.bodyIsFallback ? (
                <p className="rounded-md bg-beige/50 px-4 py-2 text-sm text-navy/85">
                  {t("englishOnlyNote")}
                </p>
              ) : null}
              <MarkdownContent
                markdown={post.body}
                lang={post.bodyLang}
                className="text-lg"
              />
            </>
          ) : (
            <p className="text-lg leading-relaxed text-navy/85">
              {post.excerpt}
            </p>
          )}
        </div>

        <ShareButtons locale={locale} url={url} title={post.title} />

        <div className="border-t border-beige pt-6">
          <Link href={listHref} className={backLinkClass}>
            <span aria-hidden="true">←&nbsp;</span>
            {t("backToList")}
          </Link>
        </div>
      </Container>
    </article>
  );
}
