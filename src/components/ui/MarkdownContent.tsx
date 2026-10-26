import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/cn";

/**
 * Server component rendering sanitized Markdown with prose styles.
 * Not exported from ui/index.ts: it imports a server-only module, and the
 * index is also used by client components.
 */
export function MarkdownContent({
  markdown,
  className,
  lang,
}: {
  markdown: string;
  className?: string;
  lang?: string;
}) {
  return (
    <div
      lang={lang}
      className={cn(
        "space-y-4 leading-relaxed text-navy/85 [&_a]:text-navy [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-gold [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-beige/60 [&_code]:px-1 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-navy [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-navy [&_h4]:font-semibold [&_h4]:text-navy [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-beige/60 [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}
