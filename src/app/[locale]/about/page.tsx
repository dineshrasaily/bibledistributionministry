import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHero } from "@/components/public/PageHero";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { SiteImage } from "@/components/ui/SiteImage";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  toAboutContent,
  type AboutSection,
  type AboutSectionKey,
} from "@/lib/about-mappers";
import { cn } from "@/lib/cn";
import { localizedHref } from "@/lib/i18n-path";
import { localizedPageMetadata } from "@/lib/metadata";
import { getLocalizedSiteSettings, getSiteSettings } from "@/lib/site-settings";

type PageProps = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: PageProps) {
  return localizedPageMetadata(params, "about", "/about");
}

type Labels = {
  heading: string;
  demo: string;
  demoBadge: string;
  englishOnly: string;
};

/** One About section: h2 + Markdown, demo fallback text, or nothing. */
function MarkdownSection({
  id,
  section,
  labels,
  tone = "white",
}: {
  id: AboutSectionKey;
  section: AboutSection<string> | null;
  labels: Labels;
  tone?: "white" | "ivory";
}) {
  if (!section) return null;
  return (
    <SectionShell id={id} heading={labels.heading} tone={tone}>
      {section.status === "content" ? (
        <>
          <MarkdownContent
            markdown={section.value}
            lang={section.textLang}
            className="text-lg"
          />
          {section.textLang ? (
            <p className="text-sm text-navy/75">{labels.englishOnly}</p>
          ) : null}
        </>
      ) : (
        <FallbackText text={labels.demo} badge={labels.demoBadge} />
      )}
    </SectionShell>
  );
}

function SectionShell({
  id,
  heading,
  tone,
  children,
}: {
  id: string;
  heading: string;
  tone: "white" | "ivory";
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`about-${id}`}
      data-testid={`about-${id}`}
      className={cn(
        "py-14 md:py-20",
        tone === "white" ? "bg-white" : "bg-ivory",
      )}
    >
      <Container className="flex max-w-3xl flex-col gap-5">
        <h2
          id={`about-${id}`}
          className="font-serif text-3xl leading-tight font-semibold text-navy sm:text-4xl"
        >
          {heading}
        </h2>
        <span aria-hidden="true" className="gold-rule" />
        {children}
      </Container>
    </section>
  );
}

function FallbackText({ text, badge }: { text: string; badge: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gold/70 bg-ivory/70 px-5 py-4">
      <p className="text-lg text-navy/85 italic">{text}</p>
      <DemoBadge label={badge} />
    </div>
  );
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "About" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const [row, site] = await Promise.all([
    getSiteSettings(),
    getLocalizedSiteSettings(locale as AppLocale),
  ]);
  const about = toAboutContent(row, locale);
  const demoBadge = tCommon("demoBadge");
  const labels = (key: AboutSectionKey): Labels => ({
    heading: t(key),
    demo: t(`demo.${key}`),
    demoBadge,
    englishOnly: t("englishOnly"),
  });

  const { story, mission } = about;

  return (
    <>
      <PageHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={site.tagline ?? t("intro")}
      />

      {story ? (
        <section
          aria-labelledby="about-story"
          data-testid="about-story"
          className="bg-ivory py-14 md:py-20"
        >
          <Container className="grid items-center gap-12 md:grid-cols-[1.2fr_1fr] md:gap-16">
            <div className="flex flex-col gap-5">
              <h2
                id="about-story"
                className="font-serif text-3xl leading-tight font-semibold text-navy sm:text-4xl"
              >
                {t("story")}
              </h2>
              <span aria-hidden="true" className="gold-rule" />
              {story.status === "content" ? (
                <div lang={story.textLang} className="flex flex-col gap-4">
                  {story.value.map((p, i) => (
                    <p key={i} className="text-lg text-navy/85">
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <FallbackText text={t("demo.story")} badge={demoBadge} />
              )}
              {story.status === "content" && about.isDemo ? (
                <DemoBadge label={demoBadge} />
              ) : null}
            </div>
            {about.image ? (
              <figure className="mx-auto w-full max-w-sm rounded-lg bg-beige p-3">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-white">
                  <SiteImage
                    src={about.image.url}
                    alt={about.image.alt}
                    fill
                    sizes="(min-width: 640px) 24rem, 100vw"
                    className="object-contain"
                  />
                </div>
              </figure>
            ) : (
              // Decorative panel: no stock photography.
              <div
                aria-hidden="true"
                className="relative mx-auto aspect-[4/5] w-full max-w-sm rounded-lg bg-beige p-3"
              >
                <div className="flex h-full flex-col items-center justify-center gap-8 rounded-md border border-gold/60">
                  <svg
                    viewBox="0 0 120 160"
                    className="h-40 w-auto"
                    fill="none"
                  >
                    <circle
                      cx="60"
                      cy="58"
                      r="40"
                      stroke="#B8924A"
                      strokeWidth="1"
                    />
                    <circle
                      cx="60"
                      cy="58"
                      r="52"
                      stroke="#B8924A"
                      strokeWidth="0.75"
                      strokeDasharray="2 6"
                    />
                    <rect
                      x="56"
                      y="20"
                      width="8"
                      height="128"
                      rx="2"
                      fill="#1E2A44"
                    />
                    <rect
                      x="30"
                      y="46"
                      width="60"
                      height="8"
                      rx="2"
                      fill="#1E2A44"
                    />
                  </svg>
                  <p className="px-6 text-center font-serif text-lg text-navy">
                    {t("photoPanelLabel")}
                  </p>
                </div>
              </div>
            )}
          </Container>
        </section>
      ) : null}

      <MarkdownSection
        id="testimony"
        section={about.testimony}
        labels={labels("testimony")}
      />

      {mission ? (
        <section
          aria-labelledby="about-mission"
          data-testid="about-mission"
          className="bg-navy py-16 md:py-24"
        >
          <Container className="flex max-w-3xl flex-col items-center gap-6 text-center">
            <h2
              id="about-mission"
              className="font-sans text-sm font-semibold tracking-[0.16em] text-gold uppercase"
            >
              {t("mission")}
            </h2>
            {mission.status === "content" ? (
              <blockquote
                lang={mission.textLang}
                className="font-serif text-2xl leading-relaxed text-white italic sm:text-3xl sm:leading-relaxed"
              >
                <p>{mission.value}</p>
              </blockquote>
            ) : (
              <p className="font-serif text-xl text-white/90 italic">
                {t("demo.mission")}
              </p>
            )}
            <span aria-hidden="true" className="gold-rule" />
            {about.isDemo ? <DemoBadge tone="dark" label={demoBadge} /> : null}
          </Container>
        </section>
      ) : null}

      <MarkdownSection
        id="vision"
        section={about.vision}
        labels={labels("vision")}
        tone="ivory"
      />
      <MarkdownSection
        id="values"
        section={about.values}
        labels={labels("values")}
      />
      <MarkdownSection
        id="statementOfFaith"
        section={about.statementOfFaith}
        labels={labels("statementOfFaith")}
        tone="ivory"
      />
      <MarkdownSection
        id="goals"
        section={about.goals}
        labels={labels("goals")}
      />

      <section
        aria-labelledby="about-cta"
        className="border-t border-beige bg-ivory py-16 md:py-20"
      >
        <Container className="flex flex-col items-center gap-5 text-center">
          <h2
            id="about-cta"
            className="max-w-2xl font-serif text-3xl leading-tight font-semibold text-navy"
          >
            {t("ctaTitle")}
          </h2>
          <p className="max-w-xl text-lg text-navy/85">{t("ctaBody")}</p>
          <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button href={localizedHref(locale, "/missions")} size="lg">
              {t("ctaMissions")}
            </Button>
            <Button
              href={localizedHref(locale, "/prayer")}
              variant="secondary"
              size="lg"
            >
              {t("ctaPrayer")}
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
