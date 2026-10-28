import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  register: vi.fn(),
  prepareImage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/actions/uploads", () => ({
  registerUploadAction: mocks.register,
}));
vi.mock("./upload-client", () => ({
  uploadFile: mocks.uploadFile,
  UploadError: class UploadError extends Error {},
}));
vi.mock("./prepare-image", () => ({ prepareImage: mocks.prepareImage }));

import { MediaUploader } from "./MediaUploader";

const png = (name = "photo.png") =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, {
    type: "image/png",
  });

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  mocks.prepareImage.mockImplementation(async (file: File) => ({
    file,
    width: 320,
    height: 240,
  }));
});

function input() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

describe("MediaUploader", () => {
  it("rejects an SVG in the browser and never uploads it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<MediaUploader mode="local" />);
    await user.upload(
      input(),
      new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only JPEG, PNG and WebP",
    );
    expect(screen.queryByRole("button", { name: /^Upload/ })).toBeNull();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("keeps Upload disabled until the alt text is filled", async () => {
    const user = userEvent.setup();
    render(<MediaUploader mode="local" />);
    await user.upload(input(), png());
    const upload = screen.getByRole("button", { name: "Upload" });
    expect(upload).toBeDisabled();
    expect(screen.getByLabelText(/^Title/)).toHaveValue("photo");
    await user.type(
      screen.getByLabelText(/alt text\) \(English\)/),
      "Two people reading",
    );
    expect(upload).toBeEnabled();
  });

  it("shows progress, registers the file and calls onUploaded", async () => {
    const user = userEvent.setup();
    let progress: (p: number) => void = () => {};
    let finish: (v: { ref: string }) => void = () => {};
    mocks.uploadFile.mockImplementation(
      (_file: File, opts: { onProgress: (p: number) => void }) => {
        progress = opts.onProgress;
        return new Promise((resolve) => (finish = resolve));
      },
    );
    const item = {
      id: "m1",
      url: "/api/uploads/x",
      titleEn: "photo",
      altTextEn: "Alt",
      type: "IMAGE",
    };
    mocks.register.mockResolvedValue({
      ok: true,
      message: "File uploaded.",
      data: item,
    });
    const onUploaded = vi.fn();
    render(
      <MediaUploader
        mode="local"
        onUploaded={onUploaded}
        galleryId="g1"
        defaultPublish
      />,
    );
    await user.upload(input(), png());
    await user.type(screen.getByLabelText(/alt text\) \(English\)/), "Alt");
    await user.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalled());
    act(() => progress(42));
    expect(screen.getByText("Uploading… 42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "42");
    await act(async () =>
      finish({ ref: "media/images/2026/10/photo-abcdefghij.png" }),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(item));
    const form = mocks.register.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(form)).toMatchObject({
      kind: "IMAGE",
      ref: "media/images/2026/10/photo-abcdefghij.png",
      altTextEn: "Alt",
      width: "320",
      height: "240",
      galleryId: "g1",
      publish: "on",
    });
    expect(screen.getByText("Uploaded.")).toBeInTheDocument();
  });

  it("shows the server's message when registering fails", async () => {
    const user = userEvent.setup();
    mocks.uploadFile.mockResolvedValue({
      ref: "media/images/2026/10/a-abcdefghij.png",
    });
    mocks.register.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      formError: "Please fix",
      fieldErrors: {
        ref: "This file isn't a valid JPEG, PNG or WebP picture.",
      },
    });
    render(<MediaUploader mode="local" />);
    await user.upload(input(), png());
    await user.type(screen.getByLabelText(/alt text\) \(English\)/), "Alt");
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "isn't a valid JPEG",
    );
  });

  it("refuses an 11th file in one batch", async () => {
    const user = userEvent.setup();
    render(<MediaUploader mode="local" />);
    await user.upload(
      input(),
      Array.from({ length: 11 }, (_, i) => png(`p${i}.png`)),
    );
    expect(screen.getAllByTestId("upload-card")).toHaveLength(10);
    expect(screen.getByRole("alert")).toHaveTextContent("at most 10 files");
  });

  it("only shows the not-set-up note when uploads are disabled", () => {
    render(<MediaUploader mode="disabled" />);
    expect(screen.getByTestId("upload-note")).toHaveTextContent(
      "not set up yet",
    );
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
