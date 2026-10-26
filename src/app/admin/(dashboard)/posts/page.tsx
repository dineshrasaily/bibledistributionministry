import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { InlineAction } from "@/components/admin/InlineAction";
import {
  CONTENT_STATUS_LABELS,
  formatDate,
  optionsOf,
  POST_TYPE_LABELS,
  type SearchParams,
} from "@/components/admin/labels";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { RecordList } from "@/components/admin/RecordList";
import { ListSkeleton } from "@/components/admin/Skeletons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ContentStatus, PostType } from "@/generated/prisma/enums";
import { parseListQuery, type ListQuery } from "@/lib/validation/list-query";
import { deletePostAction, setPostStatusAction } from "@/server/actions/posts";
import { requireAdminPage } from "@/server/auth/guards";
import { listPosts } from "@/server/services/posts";

export const metadata: Metadata = { title: "Posts" };

const FILTERS = { type: PostType, status: ContentStatus };
type Query = ListQuery<typeof FILTERS>;

async function PostsList({ query }: { query: Query }) {
  const page = await listPosts(query);
  if (page.total === 0) {
    return (
      <EmptyState
        title={
          query.q || query.type || query.status
            ? "No matching posts"
            : "No posts yet"
        }
        description="Write your first devotional, article or ministry update."
        action={<Button href="/admin/posts/new">New post</Button>}
      />
    );
  }
  return (
    <>
      <RecordList
        label="Posts"
        rows={page.items.map((post) => ({
          id: post.id,
          title: post.titleEn,
          href: `/admin/posts/${post.id}`,
          badges: (
            <>
              <StatusBadge status={post.status} />
              <Badge>{POST_TYPE_LABELS[post.type]}</Badge>
              {post.isFeatured ? <Badge variant="gold">Featured</Badge> : null}
              {post.isDemo ? <Badge>Demo</Badge> : null}
            </>
          ),
          meta: `Updated ${formatDate(post.updatedAt)}`,
          actions: (
            <>
              <InlineAction
                action={setPostStatusAction}
                fields={{
                  id: post.id,
                  status: post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                }}
                label={post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                accessibleLabel={`${post.status === "PUBLISHED" ? "Unpublish" : "Publish"} ${post.titleEn}`}
              />
              <ConfirmDialog
                action={deletePostAction}
                fields={{ id: post.id }}
                triggerLabel="Delete"
                title={`Delete "${post.titleEn}"?`}
              />
            </>
          ),
        }))}
      />
      <Pagination
        path="/admin/posts"
        query={{ q: query.q, type: query.type, status: query.status }}
        page={page.page}
        pageCount={page.pageCount}
      />
    </>
  );
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdminPage("/admin/posts");
  const query = parseListQuery(await searchParams, FILTERS);
  return (
    <>
      <PageHeader
        title="Posts"
        description="Devotionals, articles, ministry updates, Bible studies and testimonies."
        action={<Button href="/admin/posts/new">New post</Button>}
      />
      <ListToolbar
        action="/admin/posts"
        q={query.q}
        filters={[
          {
            name: "type",
            label: "Type",
            value: query.type,
            options: optionsOf(POST_TYPE_LABELS),
          },
          {
            name: "status",
            label: "Status",
            value: query.status,
            options: optionsOf(CONTENT_STATUS_LABELS),
          },
        ]}
      />
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton />}>
        <PostsList query={query} />
      </Suspense>
    </>
  );
}
