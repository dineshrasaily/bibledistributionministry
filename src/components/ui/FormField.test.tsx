import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";
import { FieldError } from "./FieldError";
import { Input } from "./Input";
import { Label } from "./Label";
import { Textarea } from "./Textarea";

describe("form primitives", () => {
  it("associates Label with Input and wires aria-describedby to the error", () => {
    render(
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input id="email" invalid errorId="email-error" />
        <FieldError id="email-error" message="Enter a valid email." />
      </div>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email.");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "email-error");
  });

  it("does not set aria-invalid/aria-describedby when valid", () => {
    render(
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" errorId="name-error" />
        <FieldError id="name-error" message="" />
      </div>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Textarea supports the same error wiring", () => {
    render(
      <div>
        <Label htmlFor="msg">Message</Label>
        <Textarea id="msg" invalid errorId="msg-error" />
        <FieldError id="msg-error" message="Required" />
      </div>,
    );
    expect(screen.getByLabelText("Message")).toHaveAttribute(
      "aria-describedby",
      "msg-error",
    );
  });

  it("Checkbox is findable by its label", () => {
    render(<Checkbox id="consent" label="Keep my request private" />);
    const checkbox = screen.getByLabelText("Keep my request private");
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });
});
