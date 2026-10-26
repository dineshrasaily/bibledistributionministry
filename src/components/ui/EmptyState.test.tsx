import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description in a status region", () => {
    render(
      <EmptyState title="No updates yet" description="Check back soon." />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No updates yet");
    expect(status).toHaveTextContent("Check back soon.");
  });

  it("renders an optional action", () => {
    render(<EmptyState title="Empty" action={<button>Refresh</button>} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
