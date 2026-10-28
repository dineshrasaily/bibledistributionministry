import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/actions/uploads", () => ({ registerUploadAction: vi.fn() }));

import { MediaPickerField } from "./MediaPickerField";

const items = [
  {
    id: "m1",
    title: "Village visit",
    url: "/api/uploads/media/images/2026/10/a-abcdefghij.png",
    alt: "People in a village",
    altNe: null,
    status: "PUBLISHED",
    uploaded: true,
  },
  {
    id: "m2",
    title: "Draft photo",
    url: "/demo/gallery/sample-1.svg",
    alt: "Pattern",
    altNe: "ढाँचा",
    status: "DRAFT",
    uploaded: false,
  },
];

function mockFetch(response: () => Response) {
  const fn = vi.fn(async () => response());
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

function renderInForm(ui: React.ReactNode) {
  return render(<form aria-label="Test form">{ui}</form>);
}

describe("MediaPickerField", () => {
  it("loads the library, picks a picture, closes and returns focus", async () => {
    const user = userEvent.setup();
    const fetchFn = mockFetch(() =>
      Response.json({ items, page: 1, pageCount: 1 }),
    );
    renderInForm(
      <MediaPickerField
        name="coverImageUrl"
        label="Cover picture"
        mode="local"
        defaultValue=""
      />,
    );
    const trigger = screen.getByRole("button", { name: /Choose from library/ });
    await user.click(trigger);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/media/library?kind=image&page=1"),
      expect.anything(),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /Use picture:\s*Village visit/,
      }),
    );
    expect(screen.getByLabelText("Cover picture")).toHaveValue(items[0]!.url);
    await waitFor(() =>
      expect(screen.queryByTestId("media-picker")).toBeNull(),
    );
    expect(trigger).toHaveFocus();
  });

  it("shows the empty and error states", async () => {
    const user = userEvent.setup();
    mockFetch(() => Response.json({ items: [], page: 1, pageCount: 1 }));
    const { unmount } = renderInForm(
      <MediaPickerField name="logoUrl" label="Logo" mode="local" />,
    );
    await user.click(
      screen.getByRole("button", { name: /Choose from library/ }),
    );
    expect(await screen.findByTestId("picker-empty")).toHaveTextContent(
      "No pictures in the library yet",
    );
    unmount();
    mockFetch(() => new Response("x", { status: 500 }));
    renderInForm(<MediaPickerField name="logoUrl" label="Logo" mode="local" />);
    await user.click(
      screen.getByRole("button", { name: /Choose from library/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be loaded",
    );
  });

  it("Remove picture clears the value", async () => {
    const user = userEvent.setup();
    renderInForm(
      <MediaPickerField
        name="logoUrl"
        label="Logo"
        mode="local"
        defaultValue="/brand/logo-mark.png"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Remove picture/ }));
    expect(screen.getByLabelText("Logo")).toHaveValue("");
  });

  it("fills only empty alt-text fields", async () => {
    const user = userEvent.setup();
    mockFetch(() => Response.json({ items, page: 1, pageCount: 1 }));
    render(
      <form aria-label="Settings">
        <MediaPickerField
          name="aboutImageUrl"
          label="Photo"
          mode="local"
          altFields={{ en: "aboutImageAltEn", ne: "aboutImageAltNe" }}
        />
        <input
          aria-label="alt en"
          name="aboutImageAltEn"
          defaultValue="Keep me"
        />
        <input aria-label="alt ne" name="aboutImageAltNe" defaultValue="" />
      </form>,
    );
    await user.click(
      screen.getByRole("button", { name: /Choose from library/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: /Use picture:\s*Draft photo/ }),
    );
    expect(screen.getByLabelText("alt en")).toHaveValue("Keep me");
    expect(screen.getByLabelText("alt ne")).toHaveValue("ढाँचा");
  });
});
