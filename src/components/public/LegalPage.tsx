import { getFormatter, getTranslations } from "next-intl/server";
import { fillLegalText, type LegalDocument } from "@/content/legal/types";
import { Container } from "@/components/ui/Container";
import type { AppLocale } from "@/i18n/routing";
import { PageHero } from "./PageHero";
import { TemplateNotice } from "./TemplateNotice";

/** Privacy / Terms layout: hero, template notice, contents, sections. */
export async function LegalPage({
  locale,
  title,
  doc,
  values,
}: {
  locale: AppLocale;
  title: string;
  doc: LegalDocument;
  /** Placeholder values ({name}, {email}, {taxNote}). */
  values: Record<string, string>;
}) {
  const t = await getTranslations({ locale, namespace: "Legal" });
  const format = await getFormatter({ locale });
  const sections = doc[locale];
  const fill = (text: string) => fillLegalText(text, values);

  return (
    <>
      <PageHero title={title} />
      <section className="bg-ivory pb-16 md:pb-24">
        <Container className="flex max-w-3xl flex-col gap-8">
          <TemplateNotice
            label={t("templateLabel")}
            text={t("templateNotice")}
          />
          <p className="text-sm text-navy/80">
            {t("lastUpdated")}:{" "}
            <time dateTime={doc.lastUpdated}>
              {format.dateTime(new Date(`${doc.lastUpdated}T00:00:00Z`), {
                dateStyle: "long",
                timeZone: "UTC",
              })}
            </time>
          </p>
          <nav
            aria-labelledby="legal-contents"
            className="rounded-lg border border-beige bg-white p-5"
          >
            <h2
              id="legal-contents"
              className="mb-3 font-sans text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase"
            >
              {t("contents")}
            </h2>
            <ol className="grid list-decimal gap-1.5 pl-5 text-navy sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="rounded-sm underline decoration-gold/70 underline-offset-4 hover:decoration-2"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-heading`}
              className="flex scroll-mt-24 flex-col gap-3"
            >
              <h2
                id={`${s.id}-heading`}
                className="font-serif text-2xl leading-tight font-semibold text-navy"
              >
                {s.heading}
              </h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="leading-relaxed text-navy/85">
                  {fill(p)}
                </p>
              ))}
              {s.bullets ? (
                <ul className="flex list-disc flex-col gap-2 pl-6 leading-relaxed text-navy/85 marker:text-gold-dark">
                  {s.bullets.map((b, i) => (
                    <li key={i}>{fill(b)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </Container>
      </section>
    </>
  );
}
