import { getTranslations } from "next-intl/server";
import { DemoBadge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { VerseBlock } from "@/components/ui/VerseBlock";
import type { AppLocale } from "@/i18n/routing";
import type { VerseView } from "@/lib/content";

export async function FeaturedVerse({
  locale,
  verse,
}: {
  locale: AppLocale;
  verse: VerseView;
}) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  // Verse text is English (WEB or KJV); Nepali pages show it with a note.
  const isEnglishPage = locale === "en";

  return (
    <section
      aria-labelledby="verse-heading"
      className="bg-white py-20 md:py-28"
    >
      <Container>
        <h2
          id="verse-heading"
          className="mb-10 text-center font-sans text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase"
        >
          {t("verseEyebrow")}
        </h2>
        <VerseBlock
          text={verse.text}
          reference={verse.reference}
          translation={verse.translation}
          textLang={isEnglishPage ? undefined : "en"}
          note={
            isEnglishPage
              ? undefined
              : t("verseNoteNe", { translation: verse.translation })
          }
          badge={
            verse.isDemo ? <DemoBadge label={tCommon("demoBadge")} /> : null
          }
        />
      </Container>
    </section>
  );
}
