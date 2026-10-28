import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteImage } from "./SiteImage";

describe("SiteImage", () => {
  it("sends Vercel Blob pictures through the image optimizer", () => {
    render(
      <div className="relative">
        <SiteImage
          src="https://store.public.blob.vercel-storage.com/media/images/a-x1.jpg"
          alt="Two people reading"
          fill
          sizes="100vw"
        />
      </div>,
    );
    const img = screen.getByRole("img", { name: "Two people reading" });
    expect(img.getAttribute("src")).toContain("/_next/image?url=");
  });

  it("renders SVGs and local uploads unoptimized", () => {
    render(
      <>
        <SiteImage
          src="/demo/gallery/sample-1.svg"
          alt="Sample"
          width={300}
          height={200}
        />
        <SiteImage
          src="/api/uploads/media/images/2026/10/a-abcdefghij.png"
          alt="Upload"
          fill
          sizes="10rem"
        />
      </>,
    );
    expect(screen.getByRole("img", { name: "Sample" })).toHaveAttribute(
      "src",
      "/demo/gallery/sample-1.svg",
    );
    expect(screen.getByRole("img", { name: "Upload" })).toHaveAttribute(
      "src",
      "/api/uploads/media/images/2026/10/a-abcdefghij.png",
    );
  });

  it("falls back to a plain lazy <img> without a size and keeps empty alt decorative", () => {
    const { container } = render(
      <SiteImage src="https://example.org/a.png" alt="" />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://example.org/a.png");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});
