import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { PrayerForm } from "./PrayerForm";

const submitPrayerAction = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/public-forms", () => ({
  submitPrayerAction,
  submitContactAction: vi.fn(),
}));
vi.mock("next/script", () => ({ default: () => null }));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PrayerForm siteKey="1x00000000000000000000AA" />
    </NextIntlClientProvider>,
  );
}

const nameInput = () => screen.getByLabelText(/Your name/);
const emailInput = () => screen.getByLabelText(/Your email/);
const bodyInput = () => screen.getByLabelText(/Your prayer request/);

beforeEach(() => {
  submitPrayerAction.mockReset();
  window.turnstile = undefined;
});

describe("PrayerForm", () => {
  it("labels every visible input; consent and anonymous are unchecked", () => {
    renderForm();
    expect(nameInput()).toHaveAttribute("name", "name");
    expect(emailInput()).toHaveAttribute("type", "email");
    expect(bodyInput()).toHaveAttribute("aria-required", "true");
    expect(
      screen.getByRole("checkbox", { name: "Send anonymously" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /share a shortened version/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("link", { name: "privacy policy" }),
    ).toHaveAttribute("href", "/en/privacy");
  });

  it("anonymous disables and clears name and email", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(nameInput(), "Sita Rai");
    await user.type(emailInput(), "sita@example.org");
    await user.click(
      screen.getByRole("checkbox", { name: "Send anonymously" }),
    );
    expect(nameInput()).toBeDisabled();
    expect(emailInput()).toBeDisabled();
    expect(nameInput()).toHaveValue("");
    expect(emailInput()).toHaveValue("");

    await user.click(
      screen.getByRole("checkbox", { name: "Send anonymously" }),
    );
    expect(nameInput()).toBeEnabled();
    expect(nameInput()).toHaveValue("");
  });

  it("anonymous submissions do not send name or email", async () => {
    const user = userEvent.setup();
    submitPrayerAction.mockResolvedValue({ status: "success" });
    renderForm();
    await user.type(nameInput(), "Sita Rai");
    await user.click(
      screen.getByRole("checkbox", { name: "Send anonymously" }),
    );
    await user.type(bodyInput(), "Pray for us");
    await user.click(
      screen.getByRole("button", { name: "Send prayer request" }),
    );
    const fd = submitPrayerAction.mock.calls[0]![1] as FormData;
    expect(fd.get("isAnonymous")).toBe("on");
    expect(fd.has("name")).toBe(false);
    expect(fd.has("email")).toBe(false);
    expect(fd.get("body")).toBe("Pray for us");
    expect(fd.get("locale")).toBe("en");
    expect(fd.get("website")).toBe("");
  });

  it("shows translated field errors linked via aria-describedby and focuses the first", async () => {
    const user = userEvent.setup();
    submitPrayerAction.mockResolvedValue({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { body: "required", email: "invalidEmail" },
    });
    renderForm();
    await user.type(nameInput(), "Kept Name");
    await user.click(
      screen.getByRole("button", { name: "Send prayer request" }),
    );
    expect(
      await screen.findByText("Please fill in this field."),
    ).toHaveAttribute("id", "prayer-body-error");
    expect(bodyInput()).toHaveAttribute("aria-invalid", "true");
    expect(bodyInput().getAttribute("aria-describedby")).toContain(
      "prayer-body-error",
    );
    expect(emailInput().getAttribute("aria-describedby")).toContain(
      "prayer-email-error",
    );
    expect(emailInput()).toHaveFocus();
    expect(screen.getByTestId("form-alert")).toHaveTextContent(
      "Please fix the highlighted fields.",
    );
    // Typed values survive the error.
    expect(nameInput()).toHaveValue("Kept Name");
  });

  it("a rate-limit error renders a focused alert", async () => {
    const user = userEvent.setup();
    submitPrayerAction.mockResolvedValue({
      status: "error",
      code: "RATE_LIMITED",
    });
    renderForm();
    await user.type(bodyInput(), "x");
    await user.click(
      screen.getByRole("button", { name: "Send prayer request" }),
    );
    const alert = await screen.findByTestId("form-alert");
    expect(alert).toHaveTextContent(/several messages in a short time/);
    expect(alert).toHaveFocus();
  });

  it("success replaces the form with a focused heading; Send another resets", async () => {
    const user = userEvent.setup();
    submitPrayerAction.mockResolvedValue({ status: "success" });
    renderForm();
    await user.type(bodyInput(), "Pray for us");
    await user.click(
      screen.getByRole("button", { name: "Send prayer request" }),
    );
    const heading = await screen.findByRole("heading", { name: "Thank you" });
    expect(heading).toHaveFocus();
    expect(screen.queryByLabelText(/Your prayer request/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Send another" }));
    expect(bodyInput()).toHaveValue("");
  });

  it("the honeypot is hidden from assistive tech and the tab order", () => {
    const { container } = renderForm();
    const trap = container.querySelector<HTMLInputElement>(
      'input[name="website"]',
    )!;
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("puts the Turnstile token into the hidden field", async () => {
    let callback: ((token: string) => void) | undefined;
    window.turnstile = {
      render: vi.fn((_el, opts) => {
        callback = opts.callback;
        return "w1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const { container } = renderForm();
    act(() => callback?.("XXXX.DUMMY.TOKEN.XXXX"));
    expect(
      container.querySelector<HTMLInputElement>('input[name="turnstileToken"]')
        ?.value,
    ).toBe("XXXX.DUMMY.TOKEN.XXXX");
  });
});
