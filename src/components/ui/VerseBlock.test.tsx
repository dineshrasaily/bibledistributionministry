import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerseBlock } from "./VerseBlock";

const text =
  "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.";

describe("VerseBlock", () => {
  it("renders the verse text inside a blockquote", () => {
    const { container } = render(
      <VerseBlock text={text} reference="John 3:16" translation="WEB" />,
    );
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).not.toBeNull();
    expect(blockquote).toHaveTextContent(text);
  });

  it("shows the reference together with the translation", () => {
    const { container } = render(
      <VerseBlock text={text} reference="John 3:16" translation="WEB" />,
    );
    const caption = container.querySelector("figcaption");
    expect(caption).toHaveTextContent("John 3:16 (WEB)");
  });

  it("renders a note and badge when given", () => {
    render(
      <VerseBlock
        text={text}
        reference="John 3:16"
        translation="WEB"
        note="Nepali translation pending"
        badge={<span>Demo content</span>}
        textLang="en"
      />,
    );
    expect(screen.getByText("Nepali translation pending")).toBeInTheDocument();
    expect(screen.getByText("Demo content")).toBeInTheDocument();
    expect(document.querySelector("blockquote")).toHaveAttribute("lang", "en");
  });

  it("omits the note when not provided", () => {
    const { container } = render(
      <VerseBlock text={text} reference="John 3:16" translation="WEB" />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});
