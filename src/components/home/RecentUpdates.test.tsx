import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecentUpdates, type UpdateCardItem } from "./RecentUpdates";

const labels = {
  eyebrow: "News",
  title: "Recent ministry updates",
  description: "Sample updates",
  emptyTitle: "No updates yet",
  emptyDescription: "Updates will appear here.",
  readMore: "Read more",
  demoBadge: "Demo content",
};

const item = (id: string): UpdateCardItem => ({
  id,
  title: `Update ${id}`,
  excerpt: "Excerpt",
  typeLabel: "Ministry update",
  publishedAt: "2026-05-12T09:00:00.000Z",
  dateLabel: "May 12, 2026",
  scriptureRefs: ["Psalm 23:1"],
  isDemo: true,
});

describe("RecentUpdates", () => {
  it("shows the empty state when there are no items", () => {
    render(<RecentUpdates items={[]} labels={labels} readMoreHref="/en" />);
    expect(screen.getByRole("status")).toHaveTextContent("No updates yet");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("renders one article per item with a demo badge", () => {
    render(
      <RecentUpdates
        items={[item("1"), item("2")]}
        labels={labels}
        readMoreHref="/en/devotionals"
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByText("Demo content")).toHaveLength(2);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
