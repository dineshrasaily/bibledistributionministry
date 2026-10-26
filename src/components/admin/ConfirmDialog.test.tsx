import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

function setup(
  action = vi.fn(async () => ({ ok: true as const, message: "Deleted." })),
) {
  render(
    <ConfirmDialog
      action={action}
      fields={{ id: "post-1" }}
      triggerLabel="Delete"
      title='Delete "My post"?'
    />,
  );
  return { action, user: userEvent.setup() };
}

describe("ConfirmDialog", () => {
  it("opens with the title, description and Cancel focused", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent('Delete "My post"?');
    expect(dialog).toHaveTextContent("This can't be undone.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("Escape closes it and focus returns to the trigger", async () => {
    const { user } = setup();
    const trigger = screen.getByRole("button", { name: "Delete" });
    await user.click(trigger);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("confirming submits the hidden form to the action", async () => {
    const { user, action } = setup();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete",
    )!;
    await user.click(confirm);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(formData.get("id")).toBe("post-1");
  });
});
