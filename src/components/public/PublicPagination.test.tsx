import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pageWindow, PublicPagination } from "./PublicPagination";

const labels = {
  label: "Pagination",
  previous: "Previous",
  next: "Next",
  pageOf: "Page 2 of 3",
};

describe("PublicPagination", () => {
  it("keeps q/type in every link and marks the current page", () => {
    render(
      <PublicPagination
        base="/en/devotionals"
        query={{ q: "hope", type: "ARTICLE", page: 2 }}
        page={2}
        pageCount={3}
        labels={labels}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/en/devotionals?q=hope&type=ARTICLE",
    );
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/en/devotionals?q=hope&type=ARTICLE&page=3",
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "1" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables Previous on the first page and renders nothing for one page", () => {
    const { rerender, container } = render(
      <PublicPagination
        base="/en/devotionals"
        query={{ page: 1 }}
        page={1}
        pageCount={2}
        labels={labels}
      />,
    );
    expect(screen.queryByRole("link", { name: /Previous/ })).toBeNull();
    expect(
      screen.getByText(/Previous/).closest("[aria-disabled]"),
    ).toHaveAttribute("aria-disabled", "true");
    rerender(
      <PublicPagination
        base="/en/devotionals"
        query={{ page: 1 }}
        page={1}
        pageCount={1}
        labels={labels}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("windows long page lists", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
  });
});
