import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatSkeleton } from "@/components/admin/Skeletons";
import { getDashboardCounts } from "@/server/services/dashboard";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

async function Stats() {
  const counts = await getDashboardCounts();
  const stats = [
    {
      label: "Published posts",
      value: counts.publishedPosts,
      href: "/admin/posts?status=PUBLISHED",
    },
    {
      label: "Drafts",
      value: counts.draftPosts,
      href: "/admin/posts?status=DRAFT",
    },
    {
      label: "Upcoming events",
      value: counts.upcomingEvents,
      href: "/admin/events?status=UPCOMING",
    },
    {
      label: "New prayer requests",
      value: counts.newPrayerRequests,
      href: "/admin/inbox/prayer?status=NEW",
    },
    {
      label: "New messages",
      value: counts.newMessages,
      href: "/admin/inbox/messages?status=NEW",
    },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <li key={stat.label}>
          <Link
            href={stat.href}
            className="flex h-full flex-col gap-1 rounded-lg border border-beige bg-white p-5 transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
          >
            <span className="font-serif text-3xl font-semibold text-navy">
              {stat.value}
            </span>
            <span className="text-sm text-navy/80">{stat.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const actor = await requireAdminPage("/admin");
  const links = [
    { href: "/admin/posts/new", label: "New post" },
    { href: "/admin/events/new", label: "New event" },
    { href: "/admin/media/new", label: "New media" },
    { href: "/admin/verses", label: "Set verse of the day" },
    ...(actor.role === "OWNER"
      ? [{ href: "/admin/settings", label: "Site settings" }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome, ${actor.name}. Here is what is happening on the site.`}
      />
      <section aria-labelledby="stats-heading" className="mb-8">
        <h2 id="stats-heading" className="sr-only">
          Overview
        </h2>
        <Suspense fallback={<StatSkeleton />}>
          <Stats />
        </Suspense>
      </section>
      <section aria-labelledby="quick-heading">
        <h2
          id="quick-heading"
          className="mb-3 font-serif text-xl font-semibold text-navy"
        >
          Quick links
        </h2>
        <ul className="flex flex-wrap gap-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full border border-navy bg-white px-5 text-sm font-medium text-navy transition-colors hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
