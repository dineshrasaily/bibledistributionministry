import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const labels = {
  copy: "Copy",
  copied: "Copied",
  failed: "Couldn't copy. Please select the text instead.",
};

function mockClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

function mockExecCommand(result: boolean) {
  const fn = vi.fn(() => result);
  Object.defineProperty(document, "execCommand", {
    value: fn,
    configurable: true,
  });
  return fn;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("uses the given accessible name", () => {
    render(
      <CopyButton
        value="give@example.org"
        label="Copy Zelle email"
        labels={labels}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Copy Zelle email" }),
    ).toBeInTheDocument();
  });

  it("copies the value and announces 'Copied'", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton
        value="give@example.org"
        label="Copy Zelle email"
        labels={labels}
      />,
    );
    const writeText = vi.fn(async () => {});
    mockClipboard(writeText);
    expect(screen.getByRole("status")).toHaveTextContent("");
    await user.click(screen.getByRole("button", { name: "Copy Zelle email" }));
    expect(writeText).toHaveBeenCalledWith("give@example.org");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("falls back to execCommand when the clipboard API is missing", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton value="021000021" label="Copy routing" labels={labels} />,
    );
    mockClipboard(undefined);
    const exec = mockExecCommand(true);
    await user.click(screen.getByRole("button", { name: "Copy routing" }));
    expect(exec).toHaveBeenCalledWith("copy");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("announces a failure when both ways fail", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton value="021000021" label="Copy routing" labels={labels} />,
    );
    mockClipboard(async () => {
      throw new Error("denied");
    });
    mockExecCommand(false);
    await user.click(screen.getByRole("button", { name: "Copy routing" }));
    expect(screen.getByRole("status")).toHaveTextContent(labels.failed);
  });

  it("clears the status after a moment", async () => {
    vi.useFakeTimers();
    render(
      <CopyButton value="x@example.org" label="Copy email" labels={labels} />,
    );
    mockClipboard(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
