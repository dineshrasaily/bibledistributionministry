import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { YouTubeFacade } from "./YouTubeFacade";

const embedUrl = "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa";

describe("YouTubeFacade", () => {
  it("renders only a labelled button before the click (no iframe, no YouTube image)", () => {
    const { container } = render(
      <YouTubeFacade
        embedUrl={embedUrl}
        title="Sample video"
        thumbnailUrl={null}
        playLabel="Play video: Sample video"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Play video: Sample video" }),
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toMatch(/ytimg|youtube\.com/);
  });

  it("loads the nocookie iframe on click and focuses it", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <YouTubeFacade
        embedUrl={embedUrl}
        title="Sample video"
        thumbnailUrl="/demo/gallery/sample-1.svg"
        playLabel="Play video: Sample video"
      />,
    );
    await user.click(screen.getByRole("button"));
    const iframe = container.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(`${embedUrl}?autoplay=1`);
    expect(iframe).toHaveAttribute("title", "Sample video");
    expect(iframe).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    expect(iframe).toHaveFocus();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for a non-nocookie URL", () => {
    const { container } = render(
      <YouTubeFacade
        embedUrl="https://www.youtube.com/embed/aaaaaaaaaaa"
        title="x"
        thumbnailUrl={null}
        playLabel="Play"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
