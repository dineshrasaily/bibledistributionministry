import "server-only";
import { prisma } from "@/lib/db";
import { countNewInbox } from "./inbox";

export type DashboardCounts = {
  publishedPosts: number;
  draftPosts: number;
  upcomingEvents: number;
  newPrayerRequests: number;
  newMessages: number;
};

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [publishedPosts, draftPosts, upcomingEvents, inbox] = await Promise.all(
    [
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.event.count({
        where: { publishStatus: "PUBLISHED", status: "UPCOMING" },
      }),
      countNewInbox(),
    ],
  );
  return {
    publishedPosts,
    draftPosts,
    upcomingEvents,
    newPrayerRequests: inbox.prayer,
    newMessages: inbox.messages,
  };
}
