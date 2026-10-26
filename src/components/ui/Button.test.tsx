import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Button,
  sizeClasses,
  variantClasses,
  type ButtonVariant,
} from "./Button";

describe("Button", () => {
  it("renders a <button type=button> by default with primary styles", () => {
    render(<Button>Pray</Button>);
    const button = screen.getByRole("button", { name: "Pray" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-navy", "text-white");
  });

  it.each(Object.keys(variantClasses) as ButtonVariant[])(
    "applies the %s variant classes",
    (variant) => {
      render(<Button variant={variant}>Label</Button>);
      const button = screen.getByRole("button", { name: "Label" });
      const expected = variantClasses[variant].split(" ")[0]!;
      expect(button).toHaveClass(expected);
    },
  );

  it("gold variant uses navy text on gold", () => {
    render(<Button variant="gold">Support</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-gold", "text-navy");
  });

  it("danger variant uses white text on red-700", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-700", "text-white");
  });

  it("applies size classes", () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      ...sizeClasses.lg.split(" "),
    );
  });

  it("renders a link (not a button) when given href", () => {
    render(
      <Button href="/en/about" variant="secondary">
        Learn More
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Learn More" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/en/about");
    expect(link).toHaveClass("border-navy");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("merges a custom className", () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});
