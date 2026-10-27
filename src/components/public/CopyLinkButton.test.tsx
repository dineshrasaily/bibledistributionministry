import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "./CopyLinkButton";

const labels = {
  copy: "Copy link",
  copied: "Link copied",
  failed: "Couldn't copy the link.",
};
const url = "https://example.org/en/devotionals/a";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyLinkButton", () => {
  it("copies the URL and announces success", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    render(<CopyLinkButton url={url} labels={labels} />);
    mockClipboard(writeText);
    expect(screen.getByRole("status")).toHaveTextContent("");
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("announces a failure when the clipboard rejects", async () => {
    const user = userEvent.setup();
    render(<CopyLinkButton url={url} labels={labels} />);
    mockClipboard(async () => {
      throw new Error("denied");
    });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Couldn't copy the link.",
    );
  });
});
