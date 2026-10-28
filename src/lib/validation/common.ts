/**
 * Shared Zod helpers for admin inputs (FormData strings). Pure module.
 */
import "./zod-setup";
import { z } from "zod";

export const REQUIRED_MSG = "Required";
const tooLong = (max: number) => `Use at most ${max} characters`;

/** Treats missing, null and whitespace-only values as absent. */
const blankToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

/** Required plain text, trimmed. */
export function requiredText(max: number) {
  return z
    .string({ error: REQUIRED_MSG })
    .trim()
    .min(1, REQUIRED_MSG)
    .max(max, tooLong(max));
}

/** Optional plain text, trimmed; empty/whitespace becomes null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, tooLong(max))
    .nullish()
    .transform((v) => (v == null || v === "" ? null : v));
}

/** Markdown that may be empty (stored as ""); raw text, no HTML stripping. */
export function markdownText(max = 50_000) {
  return z
    .string()
    .max(max, tooLong(max))
    .nullish()
    .transform((v) => (v == null || v.trim() === "" ? "" : v));
}

/** Optional Markdown; blank becomes null. Raw text, no HTML stripping. */
export function optionalMarkdown(max = 50_000) {
  return z
    .string()
    .max(max, tooLong(max))
    .nullish()
    .transform((v) => (v == null || v.trim() === "" ? null : v));
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string({ error: REQUIRED_MSG })
  .trim()
  .toLowerCase()
  .min(1, REQUIRED_MSG)
  .max(120, tooLong(120))
  .regex(
    SLUG_RE,
    "Use lowercase letters, numbers and single hyphens (for example my-first-post).",
  );

const SITE_PATH_RE = /^\/(?!\/)[A-Za-z0-9/_.\-]*$/;
export const URL_MSG =
  "Enter a full link starting with https:// or a site path starting with /.";

/** https absolute URL or a site path; rejects http:, javascript:, data:, //. */
export function isSafeUrl(value: string): boolean {
  if (SITE_PATH_RE.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function safeUrl() {
  return z
    .string({ error: REQUIRED_MSG })
    .trim()
    .min(1, REQUIRED_MSG)
    .max(500, tooLong(500))
    .refine(isSafeUrl, URL_MSG);
}

export function optionalSafeUrl() {
  return z
    .preprocess(blankToUndefined, safeUrl().optional())
    .transform((v) => v ?? null);
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
export const YOUTUBE_MSG = "Enter a YouTube link (youtube.com or youtu.be).";

/** Normalizes a YouTube link to the nocookie embed URL, or null. */
export function toYouTubeEmbed(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname))
    return null;
  let id: string | null = null;
  if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID_RE.test(id)
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : null;
}

export const youtubeUrl = z
  .string({ error: YOUTUBE_MSG })
  .trim()
  .min(1, YOUTUBE_MSG)
  .max(500, tooLong(500))
  .transform((value, ctx) => {
    const embed = toYouTubeEmbed(value);
    if (!embed) {
      ctx.addIssue({ code: "custom", message: YOUTUBE_MSG });
      return z.NEVER;
    }
    return embed;
  });

const DATETIME_MSG = "Enter a valid date and time.";
const DATE_MSG = "Enter a valid date.";

/** ISO date-time with offset (the DateTimeField posts this) -> Date. */
export const isoDateTime = z.iso
  .datetime({ offset: true, error: DATETIME_MSG })
  .transform((s) => new Date(s));

/** Optional ISO date-time; blank becomes null. */
export const optionalDateTime = z
  .preprocess(blankToUndefined, isoDateTime.optional())
  .transform((v) => v ?? null);

/** YYYY-MM-DD -> UTC midnight Date. */
export const dateOnly = z.iso
  .date({ error: DATE_MSG })
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

export const optionalDateOnly = z
  .preprocess(blankToUndefined, dateOnly.optional())
  .transform((v) => v ?? null);

/** HTML checkbox: "on" / "true" -> true, anything else (missing) -> false. */
export function checkbox() {
  return z
    .unknown()
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true);
}

/** Prisma enum object (or string tuple) -> z.enum with a friendly error. */
export function enumOf<const T extends Record<string, string>>(values: T) {
  return z.enum(values, { error: "Choose a valid option." });
}

/** cuid() ids and seeded demo ids (e.g. "isaiah-6-8", "post-1"). */
export const idSchema = z
  .string({ error: "Invalid id." })
  .trim()
  .regex(/^[a-z0-9-]{1,40}$/, "Invalid id.");

/** FormData value(s) -> trimmed, non-empty strings (missing -> []). */
export const stringList = z
  .union([z.string(), z.array(z.string())])
  .nullish()
  .transform((v) =>
    (v == null ? [] : Array.isArray(v) ? v : [v])
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );

/** Unique ids from a multi-select / checkbox group. */
export function idList(max: number) {
  return stringList
    .transform((ids) => [...new Set(ids)])
    .pipe(z.array(idSchema).max(max, `Choose at most ${max}.`));
}

/** `{ id }` payload of delete / reset actions. */
export const byIdSchema = z.object({ id: idSchema });

/** Shared email rule: trimmed + lower-cased (login, editors, CLI). */
export const emailSchema = z
  .string({ error: "Enter an email address." })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Enter a valid email address.")
      .max(254, "Use at most 254 characters"),
  );

/** Password policy (NIST 800-63B): length only; not-equal-email is refined by callers. */
export const passwordSchema = z
  .string({ error: REQUIRED_MSG })
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.");

export const PASSWORD_IS_EMAIL_MSG =
  "Your password must not be the same as your email address.";
export const PASSWORDS_DIFFER_MSG = "The passwords don't match.";

export const intentSchema = z.enum(["draft", "publish"], {
  error: "Choose Save draft or Publish.",
});
export type Intent = z.infer<typeof intentSchema>;
