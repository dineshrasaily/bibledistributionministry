import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { ContactForm } from "./ContactForm";

const submitContactAction = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/public-forms", () => ({
  submitPrayerAction: vi.fn(),
  submitContactAction,
}));
vi.mock("next/script", () => ({ default: () => null }));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ContactForm siteKey="1x00000000000000000000AA" />
    </NextIntlClientProvider>,
  );
}

const consent = () =>
  screen.queryByRole("checkbox", { name: /share a shortened version/ });

beforeEach(() => {
  submitContactAction.mockReset();
});

describe("ContactForm", () => {
  it("offers testimony consent only for Testimony, unchecked, and drops it on change", async () => {
    const user = userEvent.setup();
    renderForm();
    const kind = screen.getByLabelText("What is this about?");
    expect(consent()).toBeNull();

    await user.selectOptions(kind, "TESTIMONY");
    expect(consent()).not.toBeChecked();
    await user.click(consent()!);
    expect(consent()).toBeChecked();

    await user.selectOptions(kind, "VOLUNTEER");
    expect(consent()).toBeNull();
    expect(screen.getByRole("link", { name: "missions page" })).toHaveAttribute(
      "href",
      "/en/missions",
    );

    await user.selectOptions(kind, "TESTIMONY");
    expect(consent()).not.toBeChecked();
  });

  it("labels the required fields", () => {
    renderForm();
    for (const label of [/Your name/, /Your email/, /Subject/, /Message/]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-required",
        "true",
      );
    }
  });

  it("sends the fields and maps field errors back", async () => {
    const user = userEvent.setup();
    submitContactAction.mockResolvedValue({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { subject: "tooLong:150" },
    });
    renderForm();
    await user.type(screen.getByLabelText(/Your name/), "Ram");
    await user.type(screen.getByLabelText(/Your email/), "ram@example.org");
    await user.type(screen.getByLabelText(/Subject/), "Hi");
    await user.type(screen.getByLabelText(/^Message/), "Hello");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    const fd = submitContactAction.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(fd)).toMatchObject({
      name: "Ram",
      email: "ram@example.org",
      kind: "GENERAL",
      subject: "Hi",
      message: "Hello",
      locale: "en",
    });
    expect(fd.has("shareConsent")).toBe(false);
    expect(
      await screen.findByText("Please use at most 150 characters."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject/)).toHaveFocus();
  });
});
