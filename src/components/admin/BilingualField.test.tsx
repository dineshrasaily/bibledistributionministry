import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BilingualField, NE_HINT } from "./BilingualField";

describe("BilingualField", () => {
  it("renders labelled English and Nepali inputs with their own ids", () => {
    render(
      <BilingualField
        name="title"
        label="Title"
        required
        defaultEn="Hello"
        defaultNe="नमस्ते"
      />,
    );
    const en = screen.getByLabelText(/Title \(English\)/);
    const ne = screen.getByLabelText(/Title \(नेपाली, Nepali\)/);
    expect(en).toHaveAttribute("name", "titleEn");
    expect(ne).toHaveAttribute("name", "titleNe");
    expect(en.id).not.toBe(ne.id);
    expect(en).toHaveValue("Hello");
    expect(ne).toHaveValue("नमस्ते");
    expect(ne).toHaveAttribute("lang", "ne");
    expect(en).toHaveAttribute("aria-required", "true");
    expect(ne).not.toHaveAttribute("aria-required");
  });

  it("wires the Nepali hint through aria-describedby", () => {
    render(<BilingualField name="excerpt" label="Summary" multiline />);
    const ne = screen.getByLabelText(/Summary \(नेपाली, Nepali\)/);
    expect(ne.tagName).toBe("TEXTAREA");
    const hintId = ne.getAttribute("aria-describedby")!;
    expect(document.getElementById(hintId)).toHaveTextContent(NE_HINT);
  });
});
