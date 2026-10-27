import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardMeta, CardTitle } from "@/components/ui/Card";
import type { AppLocale } from "@/i18n/routing";
import type { PostSummary } from "@/lib/content";
import { localizedHref } from "@/lib/i18n-path";

/** Card linking to /devotionals/[slug]. */
export async function PostCard({
  locale,
  post,
  headingLevel = "h3",
}: {
  locale: AppLocale;
  post: PostSummary;
  headingLevel?: "h2" | "h3";
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tPost = await getTranslations({ locale, namespace: "PostTypes" });
  const format = await getFormatter({ locale });
  const href = localizedHref(locale, `/devotionals/${post.slug}`);

  return (
    <Card as="article" className="w-full" data-testid="post-card">
      {post.coverImageUrl ? (
        // TODO(Phase 7): next/image + Blob
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex aspect-[16/7] items-center justify-center bg-beige"
        >
          <span className="font-serif text-5xl text-gold-dark">&ldquo;</span>
        </div>
      )}
      <CardBody>
        <CardMeta>
          <Badge>{tPost(post.type)}</Badge>
          <time dateTime={post.publishedAt}>
            {format.dateTime(new Date(post.publishedAt), {
              dateStyle: "medium",
              timeZone: "UTC",
            })}
          </time>
        </CardMeta>
        <CardTitle as={headingLevel}>{post.title}</CardTitle>
        {post.excerpt !== "" ? (
          <p className="text-base text-navy/80">{post.excerpt}</p>
        ) : null}
        {post.scriptureRefs.length > 0 ? (
          <p className="text-sm font-medium text-gold-dark">
            {post.scriptureRefs.join(" · ")}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          {post.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null}
          <Link
            href={href}
            className="rounded-sm text-sm font-semibold text-navy underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
          >
            {tCommon("readMore")}
            <span className="sr-only">: {post.title}</span>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
