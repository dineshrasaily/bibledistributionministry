import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { DonationForm } from "./DonationForm";

const startCheckoutAction = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/public-donations", () => ({ startCheckoutAction }));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DonationForm />
    </NextIntlClientProvider>,
  );
}

const submitButton = () => screen.getByRole("button", { name: /Continue to/ });
const otherInput = () =>
  screen.getByLabelText("Other amount in US dollars", { selector: "input" });

beforeEach(() => {
  startCheckoutAction.mockReset();
});

describe("DonationForm", () => {
  it("groups radios in fieldsets with legends and accessible names", () => {
    renderForm();
    const frequency = screen.getByRole("group", { name: "How often" });
    expect(
      within(frequency).getByRole("radio", { name: "One-time" }),
    ).toBeChecked();
    expect(
      within(frequency).getByRole("radio", { name: "Monthly" }),
    ).not.toBeChecked();
    const amount = screen.getByRole("group", { name: "Amount (US dollars)" });
    for (const name of ["$25", "$50", "$100", "$250", "Other amount"]) {
      expect(within(amount).getByRole("radio", { name })).not.toBeChecked();
    }
    expect(screen.getByRole("form", { name: "Give online" })).toBeTruthy();
  });

  it("'Other amount' reveals the input, focuses it and wires the hint", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(otherInput()).not.toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Other amount" }));
    expect(otherInput()).toBeVisible();
    expect(otherInput()).toHaveFocus();
    expect(otherInput()).toHaveAttribute("inputmode", "decimal");
    const hintId = otherInput().getAttribute("aria-describedby");
    expect(document.getElementById(hintId!)).toHaveTextContent(
      "From $5 to $10,000.",
    );
    // Choosing a preset hides it but keeps the value.
    await user.type(otherInput(), "12.34");
    await user.click(screen.getByRole("radio", { name: "$25" }));
    expect(otherInput()).not.toBeVisible();
    expect(otherInput()).toHaveValue("12.34");
  });

  it("monthly changes the button text and shows the monthly hint", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(submitButton()).toHaveTextContent("Continue to secure payment");
    await user.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(submitButton()).toHaveTextContent("Continue to set up monthly gift");
    expect(screen.getByText(/once a month until you cancel/)).toBeVisible();
  });

  it("submits the choice; a returned field error is shown, invalid and focused", async () => {
    const user = userEvent.setup();
    startCheckoutAction.mockResolvedValue({
      status: "error",
      code: "VALIDATION",
      fieldErrors: { customAmount: "amountTooSmall:5" },
    });
    renderForm();
    await user.click(screen.getByRole("radio", { name: "Other amount" }));
    await user.type(otherInput(), "4");
    await user.click(submitButton());
    const fd = startCheckoutAction.mock.calls[0]![1] as FormData;
    expect(fd.get("amountChoice")).toBe("custom");
    expect(fd.get("customAmount")).toBe("4");
    expect(fd.get("interval")).toBe("ONE_TIME");
    expect(fd.get("locale")).toBe("en");
    expect(fd.get("website")).toBe("");
    expect(
      await screen.findByText("The smallest gift online is $5."),
    ).toBeVisible();
    expect(otherInput()).toHaveAttribute("aria-invalid", "true");
    expect(otherInput().getAttribute("aria-describedby")).toContain(
      "donation-customAmount-error",
    );
    expect(otherInput()).toHaveFocus();
  });

  it.each([
    ["NOT_AVAILABLE", "Online giving is not available right now"],
    ["RATE_LIMITED", "You have started several payments"],
    ["ERROR", "the payment page could not be opened"],
  ])("%s shows a focused alert", async (code, text) => {
    const user = userEvent.setup();
    startCheckoutAction.mockResolvedValue({ status: "error", code });
    renderForm();
    await user.click(screen.getByRole("radio", { name: "$50" }));
    await user.click(submitButton());
    const alert = await screen.findByTestId("form-alert");
    expect(alert).toHaveTextContent(text);
    expect(alert).toHaveFocus();
  });

  it("renders the honeypot hidden from people and assistive tech", () => {
    const { container } = renderForm();
    const trap = container.querySelector('input[name="website"]')!;
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
  });
});
