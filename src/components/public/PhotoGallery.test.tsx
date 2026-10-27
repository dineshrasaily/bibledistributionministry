import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PhotoGallery, type GalleryPhoto } from "./PhotoGallery";

const photos: GalleryPhoto[] = [1, 2, 3].map((n) => ({
  id: `p${n}`,
  url: `/demo/gallery/sample-${n}.svg`,
  alt: `Sample ${n}`,
  caption: n === 2 ? "Caption two" : null,
  openLabel: `Open photo: Sample ${n}`,
}));

const labels = {
  close: "Close",
  previous: "Previous photo",
  next: "Next photo",
  counter: "Photo {current} of {total}",
  hint: "Use the arrow keys.",
};

describe("PhotoGallery", () => {
  it("opens the clicked photo with a title and counter", async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} labels={labels} />);
    await user.click(
      screen.getByRole("button", { name: "Open photo: Sample 2" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Caption two");
    expect(screen.getByTestId("lightbox-counter")).toHaveTextContent(
      "Photo 2 of 3",
    );
    expect(screen.getByRole("img", { name: "Sample 2" })).toBeInTheDocument();
  });

  it("cycles with the arrow keys and buttons, wrapping around", async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} labels={labels} />);
    await user.click(
      screen.getByRole("button", { name: "Open photo: Sample 3" }),
    );
    const counter = () => screen.getByTestId("lightbox-counter");
    await user.keyboard("{ArrowRight}");
    expect(counter()).toHaveTextContent("Photo 1 of 3");
    await user.keyboard("{ArrowLeft}");
    expect(counter()).toHaveTextContent("Photo 3 of 3");
    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(counter()).toHaveTextContent("Photo 2 of 3");
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(counter()).toHaveTextContent("Photo 3 of 3");
  });

  it("Escape closes and focus returns to the thumbnail", async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} labels={labels} />);
    const thumb = screen.getByRole("button", { name: "Open photo: Sample 1" });
    await user.click(thumb);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(thumb).toHaveFocus();
  });
});
