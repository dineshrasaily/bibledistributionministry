// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("removes script tags including their text", () => {
    const html = renderMarkdown("Hi <script>alert(1)</script> there");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("removes img/iframe and on* attributes", () => {
    const html = renderMarkdown(
      '<img src=x onerror="alert(1)"><iframe src="https://x"></iframe><p onclick="x()">Hi</p>',
    );
    expect(html).not.toMatch(/<img|<iframe|onerror|onclick/);
    expect(html).toContain("<p>Hi</p>");
  });

  it("drops javascript: and data: hrefs but keeps the forced rel", () => {
    const js = renderMarkdown("[x](javascript:alert(1))");
    expect(js).not.toContain("javascript:");
    expect(js).toContain('rel="noopener noreferrer nofollow"');
    const data = renderMarkdown("[y](data:text/html;base64,AAAA)");
    expect(data).not.toContain("data:");
  });

  it("adds rel to links", () => {
    expect(renderMarkdown("[site](https://example.org)")).toBe(
      '<p><a href="https://example.org" rel="noopener noreferrer nofollow">site</a></p>\n',
    );
  });

  it('overwrites an author rel="opener" with exactly the forced value', () => {
    const html = renderMarkdown('<a href="https://x.org" rel="opener">x</a>');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).not.toContain('rel="opener"');
    expect(html.match(/rel=/g)).toHaveLength(1);
  });

  it("turns h1 into h2", () => {
    expect(renderMarkdown("# Title")).toBe("<h2>Title</h2>\n");
  });

  it("keeps normal Markdown (lists, emphasis, code)", () => {
    const html = renderMarkdown(
      "- one\n- **two**\n\n*em* and `code`\n\n```\nblock\n```",
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<li><strong>two</strong></li>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<pre><code>block");
  });
});
