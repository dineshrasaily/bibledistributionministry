import { describe, expect, it } from "vitest";
import { privacyPolicy } from "./privacy";
import { termsOfUse } from "./terms";
import { fillLegalText, type LegalDocument } from "./types";

const docs: [string, LegalDocument][] = [
  ["privacy", privacyPolicy],
  ["terms", termsOfUse],
];

const allText = (doc: LegalDocument, locale: "en" | "ne") =>
  doc[locale]
    .flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])])
    .join("\n");

describe.each(docs)("%s template", (_name, doc) => {
  it("has the same section ids in the same order in en and ne", () => {
    expect(doc.ne.map((s) => s.id)).toEqual(doc.en.map((s) => s.id));
  });

  it("has no empty section and a valid last-updated date", () => {
    for (const section of [...doc.en, ...doc.ne]) {
      expect(section.heading.trim(), section.id).not.toBe("");
      expect(section.paragraphs.length, section.id).toBeGreaterThan(0);
      for (const p of [...section.paragraphs, ...(section.bullets ?? [])])
        expect(p.trim(), section.id).not.toBe("");
    }
    expect(doc.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("makes no charitable-status claims and never hard-codes tax status", () => {
    for (const locale of ["en", "ne"] as const) {
      const text = allText(doc, locale);
      expect(text).not.toMatch(/501\(c\)|registered charity/i);
      expect(text).not.toMatch(/tax[- ]deductible/i);
      expect(text).not.toContain("Demo Ministry");
    }
  });
});

describe("privacy policy content", () => {
  const en = allText(privacyPolicy, "en");

  it("describes hashed IPs (never raw), consent gating and private prayer requests", () => {
    expect(en).toMatch(/hash/i);
    expect(en).toMatch(/never store your raw IP/i);
    expect(en).toMatch(/consent/i);
    expect(en).toMatch(/anonymous/i);
    expect(en).toMatch(/never the text of your request/i);
    expect(allText(privacyPolicy, "ne")).toMatch(/ह्यास/);
  });

  it("names the actual providers and no AWS service", () => {
    for (const provider of [
      "Vercel",
      "Neon",
      "Vercel Blob",
      "Resend",
      "Turnstile",
      "Stripe",
      "youtube-nocookie.com",
    ]) {
      expect(en).toContain(provider);
    }
    expect(en).not.toMatch(/amazon|aws|\bs3\b/i);
  });
});

describe("terms content", () => {
  it("leaves the tax wording to donationTaxNote via {taxNote}", () => {
    expect(allText(termsOfUse, "en")).toContain("{taxNote}");
    expect(allText(termsOfUse, "ne")).toContain("{taxNote}");
  });
});

describe("fillLegalText", () => {
  it("fills known placeholders and leaves unknown ones", () => {
    expect(
      fillLegalText("{name} at {email} {other}", {
        name: "Ministry",
        email: "a@b.org",
      }),
    ).toBe("Ministry at a@b.org {other}");
  });
});
