import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { buildShareLinks } from "@/lib/share-links";
import { CopyLinkButton } from "./CopyLinkButton";

const linkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/30 bg-white px-4 text-sm font-medium text-navy transition-colors hover:border-navy hover:bg-navy/5";

/** Plain share links (no SDKs or trackers) plus a copy-link button. */
export async function ShareButtons({
  locale,
  url,
  title,
}: {
  locale: AppLocale;
  /** Absolute canonical URL of the page. */
  url: string;
  title: string;
}) {
  const t = await getTranslations({ locale, namespace: "Share" });
  const tDetail = await getTranslations({ locale, namespace: "PostDetail" });
  const links = buildShareLinks(url, title);
  const external = [
    { key: "facebook", href: links.facebook, label: t("facebook") },
    { key: "x", href: links.x, label: t("x") },
    { key: "whatsapp", href: links.whatsapp, label: t("whatsapp") },
  ] as const;

  return (
    <section aria-labelledby="share-heading" data-testid="share-buttons">
      <h2
        id="share-heading"
        className="mb-3 font-sans text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase"
      >
        {tDetail("shareHeading")}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        {external.map((l) => (
          <a
            key={l.key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {l.label}
            <span className="sr-only"> {t("opensInNewTab")}</span>
          </a>
        ))}
        <a href={links.email} className={linkClass}>
          {t("email")}
        </a>
        <CopyLinkButton
          url={url}
          className={linkClass}
          labels={{
            copy: t("copyLink"),
            copied: t("copied"),
            failed: t("copyFailed"),
          }}
        />
      </div>
    </section>
  );
}
