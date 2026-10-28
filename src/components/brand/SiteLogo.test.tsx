import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteLogo } from "./SiteLogo";

describe("SiteLogo", () => {
  it.each([
    "/brand/logo-mark.png",
    "https://x.public.blob.vercel-storage.com/media/a.png",
  ])("renders %s as a decorative image", (url) => {
    const { container } = render(
      <SiteLogo logoUrl={url} className="h-12" fallbackClassName="size-10" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", url);
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveClass("h-12");
    expect(container.querySelector("svg")).toBeNull();
  });

  it.each([null, undefined, "", "   "])(
    "falls back to the placeholder mark for %j",
    (url) => {
      const { container } = render(
        <SiteLogo logoUrl={url} fallbackClassName="size-10" />,
      );
      expect(container.querySelector("img")).toBeNull();
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveClass("size-10");
    },
  );

  it.each([
    "javascript:alert(1)",
    "//evil.example/x.png",
    "http://x.example/a.png",
    "data:image/png;base64,AAAA",
  ])("refuses the unsafe url %s", (url) => {
    const { container } = render(<SiteLogo logoUrl={url} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
