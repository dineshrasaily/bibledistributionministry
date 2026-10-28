/**
 * Upload allow-list shared by the browser, the route handlers and the
 * services. The server always decides by extension + declared MIME type +
 * magic bytes; all three must agree. Pure module.
 */

export const UPLOAD_KINDS = ["IMAGE", "AUDIO"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB
export const AUDIO_MAX_BYTES = 100 * 1024 * 1024; // 100 MiB
export const MAX_FILES_PER_BATCH = 10;

export const MAX_BYTES: Record<UploadKind, number> = {
  IMAGE: IMAGE_MAX_BYTES,
  AUDIO: AUDIO_MAX_BYTES,
};

/** kind -> MIME type -> allowed extensions (the first one is canonical). */
export const ALLOWED = {
  IMAGE: {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  },
  AUDIO: {
    "audio/mpeg": ["mp3"],
    "audio/mp4": ["m4a"],
  },
} as const satisfies Record<UploadKind, Record<string, readonly string[]>>;

export type AllowedMime =
  keyof (typeof ALLOWED)["IMAGE"] | keyof (typeof ALLOWED)["AUDIO"];

/** Canonical stored extensions per kind (folder rules for storage keys). */
const KIND_EXTS: Record<UploadKind, readonly string[]> = {
  IMAGE: ["jpg", "png", "webp"],
  AUDIO: ["mp3", "m4a"],
};
const KIND_FOLDER: Record<UploadKind, "images" | "audio"> = {
  IMAGE: "images",
  AUDIO: "audio",
};

export const UPLOAD_MESSAGES = {
  empty: "This file is empty.",
  name: "The file has no name. Rename it and try again.",
  type: "Only JPEG, PNG and WebP pictures or MP3 and M4A audio can be uploaded.",
  kind: {
    IMAGE: "Choose a picture here (JPEG, PNG or WebP).",
    AUDIO: "Choose an audio file here (MP3 or M4A).",
  },
  size: {
    IMAGE: "Pictures can be at most 8 MB.",
    AUDIO: "Audio files can be at most 100 MB.",
  },
  invalidContent: {
    IMAGE: "This file isn't a valid JPEG, PNG or WebP picture.",
    AUDIO: "This file isn't a valid MP3 or M4A audio file.",
  },
} as const;

export const LIMITS_TEXT =
  "JPEG, PNG or WebP up to 8 MB; MP3 or M4A up to 100 MB.";

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
};

/** Lower-cases, drops parameters and maps known aliases. */
export function normalizeMime(type: string | null | undefined): string {
  const base = (type ?? "").split(";")[0]!.trim().toLowerCase();
  return MIME_ALIASES[base] ?? base;
}

function kindOfMime(mime: string): UploadKind | null {
  for (const kind of UPLOAD_KINDS) {
    if (mime in ALLOWED[kind]) return kind;
  }
  return null;
}

/** The allowed MIME type for an extension, or null. */
export function mimeForExt(ext: string): AllowedMime | null {
  const lower = ext.toLowerCase();
  for (const kind of UPLOAD_KINDS) {
    for (const [mime, exts] of Object.entries(ALLOWED[kind])) {
      if ((exts as readonly string[]).includes(lower)) {
        return mime as AllowedMime;
      }
    }
  }
  return null;
}

/** Canonical extension of an allowed MIME type ("jpg" for image/jpeg). */
export function extForMime(mime: string): string | null {
  const kind = kindOfMime(mime);
  if (!kind) return null;
  return (ALLOWED[kind] as Record<string, readonly string[]>)[mime]![0]!;
}

/** All allowed MIME types of a kind. */
export function mimesOf(kind: UploadKind): string[] {
  return Object.keys(ALLOWED[kind]);
}

/** Value for <input type="file" accept>. */
export function acceptAttribute(accept: "image" | "image+audio"): string {
  const kinds: UploadKind[] =
    accept === "image" ? ["IMAGE"] : ["IMAGE", "AUDIO"];
  return kinds
    .flatMap((kind) =>
      Object.entries(ALLOWED[kind]).flatMap(([mime, exts]) => [
        mime,
        ...(exts as readonly string[]).map((e) => `.${e}`),
      ]),
    )
    .join(",");
}

export type UploadCheck =
  | { ok: true; kind: UploadKind; mime: AllowedMime; ext: string }
  | {
      ok: false;
      reason: "empty" | "type" | "size" | "name" | "kind";
      message: string;
    };

/**
 * Checks a file's name, declared type and size against the allow-list.
 * A blank or generic declared type falls back to the extension's type (some
 * browsers report "" for .m4a); the magic bytes are checked separately.
 */
export function classifyUpload(file: {
  filename: string;
  contentType: string | null | undefined;
  size: number;
  kind?: UploadKind;
}): UploadCheck {
  const name = file.filename.trim();
  if (name === "") {
    return { ok: false, reason: "name", message: UPLOAD_MESSAGES.name };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "empty", message: UPLOAD_MESSAGES.empty };
  }
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const extMime = mimeForExt(ext);
  const declared = normalizeMime(file.contentType);
  const mime =
    declared === "" || declared === "application/octet-stream"
      ? extMime
      : declared;
  const kind = mime ? kindOfMime(mime) : null;
  if (!mime || !kind || extMime !== mime) {
    return { ok: false, reason: "type", message: UPLOAD_MESSAGES.type };
  }
  if (file.kind && file.kind !== kind) {
    return {
      ok: false,
      reason: "kind",
      message: UPLOAD_MESSAGES.kind[file.kind],
    };
  }
  if (file.size > MAX_BYTES[kind]) {
    return { ok: false, reason: "size", message: UPLOAD_MESSAGES.size[kind] };
  }
  return { ok: true, kind, mime: mime as AllowedMime, ext: extForMime(mime)! };
}

const M4A_BRANDS = new Set([
  "M4A ",
  "M4B ",
  "mp42",
  "isom",
  "mp41",
  "iso2",
  "dash",
]);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** MIME type detected from the first bytes of a file, or null. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 4, 8) === "ftyp" &&
    M4A_BRANDS.has(ascii(bytes, 8, 12))
  ) {
    return "audio/mp4";
  }
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  return null;
}

/** True when the bytes really are the declared (allowed) type. */
export function matchesSniff(mime: string, bytes: Uint8Array): boolean {
  const sniffed = sniffMime(bytes);
  return sniffed !== null && sniffed === normalizeMime(mime);
}

/** File name -> safe ASCII slug (no folders, no extension), max 60 chars. */
export function safeBaseName(filename: string): string {
  const leaf = filename.split(/[\\/]/).pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const slug = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug === "" ? "file" : slug;
}

const LOCAL_KEY_RE =
  /^media\/(images|audio)\/\d{4}\/\d{2}\/[a-z0-9-]{1,60}-[a-z0-9]{10}\.(jpg|png|webp|mp3|m4a)$/;
const BLOB_PATH_RE =
  /^media\/(images|audio)\/[a-z0-9-]{1,60}(-[A-Za-z0-9]{1,40})?\.(jpg|png|webp|mp3|m4a)$/;
const RANDOM_RE = /^[a-z0-9]{10}$/;

function folderMatchesExt(folder: string, ext: string): boolean {
  const kind = folder === "images" ? "IMAGE" : "AUDIO";
  return KIND_EXTS[kind].includes(ext);
}

/** Kind of a storage key / blob pathname by its folder, or null. */
export function kindOfKey(key: string): UploadKind | null {
  if (key.startsWith("media/images/")) return "IMAGE";
  if (key.startsWith("media/audio/")) return "AUDIO";
  return null;
}

/** Server-generated key of a locally stored file. */
export function buildLocalKey(
  kind: UploadKind,
  filename: string,
  ext: string,
  now: Date,
  random10: string,
): string {
  if (!RANDOM_RE.test(random10))
    throw new Error("random10 must be 10 [a-z0-9]");
  if (!KIND_EXTS[kind].includes(ext))
    throw new Error("extension/kind mismatch");
  const yyyy = String(now.getUTCFullYear()).padStart(4, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${KIND_FOLDER[kind]}/${yyyy}/${mm}/${safeBaseName(filename)}-${random10}.${ext}`;
}

/** Strict local key check (no traversal, lower-case, extension matches folder). */
export function isLocalKey(key: string): boolean {
  const m = LOCAL_KEY_RE.exec(key);
  return m !== null && folderMatchesExt(m[1]!, m[2]!);
}

/** Pathname requested from Vercel Blob (it adds a random suffix). */
export function blobPathname(
  kind: UploadKind,
  filename: string,
  ext: string,
): string {
  if (!KIND_EXTS[kind].includes(ext))
    throw new Error("extension/kind mismatch");
  return `media/${KIND_FOLDER[kind]}/${safeBaseName(filename)}.${ext}`;
}

/** Strict Vercel Blob pathname check (extension matches folder). */
export function isBlobPathname(pathname: string): boolean {
  const m = BLOB_PATH_RE.exec(pathname);
  return m !== null && folderMatchesExt(m[1]!, m[3]!);
}

/** "My_photo-2026.jpg" -> "My photo 2026" (max 160 chars). */
export function titleFromFilename(filename: string): string {
  const leaf = filename.split(/[\\/]/).pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  return stem
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/** Scales (w, h) down so the longest side is at most `max`. */
export function fitWithin(
  width: number,
  height: number,
  max = 2560,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** "1.2 MB" style size for admin labels. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
