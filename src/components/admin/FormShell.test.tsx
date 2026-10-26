import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BilingualField } from "./BilingualField";
import { FormShell } from "./FormShell";
import { ToastProvider } from "./ToastProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

describe("FormShell", () => {
  it("shows and focuses an error summary listing field errors, and keeps values", async () => {
    const action = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      formError: "Please fix the highlighted fields.",
      fieldErrors: { titleEn: "Required" },
    }));
    const user = userEvent.setup();
    render(
      <FormShell action={action}>
        <BilingualField name="title" label="Title" required />
        <button type="submit" name="intent" value="draft">
          Save draft
        </button>
      </FormShell>,
    );
    const ne = screen.getByLabelText(/Title \(नेपाली, Nepali\)/);
    await user.type(ne, "शीर्षक");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    const summary = await screen.findByTestId("form-error-summary");
    expect(summary).toHaveAttribute("role", "alert");
    await waitFor(() => expect(summary).toHaveFocus());
    const link = await screen.findByRole("link", {
      name: /Title \(English\): Required/,
    });
    expect(link).toHaveAttribute("href", "#f-titleEn");

    const en = screen.getByLabelText(/Title \(English\)/);
    expect(en).toHaveAttribute("aria-invalid", "true");
    expect(ne).toHaveValue("शीर्षक");

    const formData = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(formData.get("intent")).toBe("draft");
    expect(formData.get("titleNe")).toBe("शीर्षक");
  });

  it("shows a success toast", async () => {
    const action = vi.fn(async () => ({
      ok: true as const,
      message: "Post saved.",
    }));
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FormShell action={action}>
          <button type="submit">Save</button>
        </FormShell>
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Post saved.")).toBeInTheDocument();
    expect(screen.queryByTestId("form-error-summary")).toBeNull();
  });
});
