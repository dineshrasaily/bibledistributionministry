/**
 * Heuristic personal-information check for admin-edited public text.
 * The admin's "I removed personal details" confirmation stays the real
 * control; this only catches the obvious leftovers. Pure module.
 */

export type PersonalInfoKind = "email" | "phone" | "name";

const EMAIL_RE = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[^\s@<>()[\]]+/u;
// A run of 7+ digits (ASCII or Devanagari), allowing spaces, dashes, dots,
// parentheses and a leading +.
const PHONE_RE = /\+?[0-9०-९](?:[\s.\-()]*[0-9०-९]){6,}/u;

/** Words of 3+ letters from the submitter's name and email local part. */
function identifyingWords(name?: string | null, email?: string | null) {
  const sources = [name ?? "", (email ?? "").split("@")[0] ?? ""];
  const words = sources
    .flatMap((s) => s.split(/[^\p{L}\p{M}]+/u))
    .map((w) => w.toLocaleLowerCase())
    .filter((w) => [...w].length >= 3);
  return [...new Set(words)];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which kinds of personal information `text` appears to contain. */
export function findPersonalInfo(
  text: string,
  submitter: { name?: string | null; email?: string | null } = {},
): PersonalInfoKind[] {
  const found: PersonalInfoKind[] = [];
  if (EMAIL_RE.test(text)) found.push("email");
  if (PHONE_RE.test(text)) found.push("phone");
  const words = identifyingWords(submitter.name, submitter.email);
  const hasName = words.some((word) =>
    // Whole word: not preceded/followed by another letter or mark.
    new RegExp(
      `(?<![\\p{L}\\p{M}])${escapeRegExp(word)}(?![\\p{L}\\p{M}])`,
      "iu",
    ).test(text),
  );
  if (hasName) found.push("name");
  return found;
}
