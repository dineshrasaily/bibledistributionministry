/**
 * PublicShare row -> public view model. Pure module.
 * Only admin-edited public text ever reaches this mapper.
 */
import type { PublicShareKind } from "@/generated/prisma/enums";

export type PublicShareRow = {
  id: string;
  kind: PublicShareKind;
  textEn: string | null;
  textNe: string | null;
  publishedAt: Date;
};

export type PublicShareView = {
  id: string;
  kind: PublicShareKind;
  text: string;
  /** Language of `text` (it may fall back to the other locale). */
  lang: "en" | "ne";
  publishedAt: Date;
};

const present = (s: string | null) => (s && s.trim() !== "" ? s : null);

export function toPublicShareView(
  row: PublicShareRow,
  locale: string,
): PublicShareView | null {
  const en = present(row.textEn);
  const ne = present(row.textNe);
  const [text, lang] =
    locale === "ne"
      ? ne
        ? [ne, "ne" as const]
        : [en, "en" as const]
      : en
        ? [en, "en" as const]
        : [ne, "ne" as const];
  if (!text) return null;
  return {
    id: row.id,
    kind: row.kind,
    text,
    lang,
    publishedAt: row.publishedAt,
  };
}
