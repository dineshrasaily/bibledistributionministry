import type { StorageMode } from "@/lib/storage-mode";

/** Hint for picture-only fields (covers, logo, About photo). */
export const IMAGE_FIELD_HINT =
  "Choose a picture from the media library or upload a new one. You can also paste an image link (https://…) or a site path such as /brand/logo-mark.png.";

/** Hints for the link field of a pasted-link media item, by type. */
export const MEDIA_LINK_HINTS = {
  IMAGE:
    "Paste a link to a JPEG, PNG or WebP picture, or upload the file in the Media library.",
  AUDIO:
    "Paste a link to an MP3 or M4A file, or upload the file in the Media library.",
  VIDEO_EMBED:
    "Paste a YouTube link. Video files can't be uploaded; put videos on YouTube first.",
} as const;

export const THUMBNAIL_HINT = `${IMAGE_FIELD_HINT} Upload a thumbnail rather than linking to YouTube's image, so visitors' browsers don't contact YouTube before they press play.`;

export const UPLOAD_NOTE_ENABLED =
  "Upload pictures (JPEG, PNG or WebP, up to 8 MB) and audio (MP3 or M4A, up to 100 MB) with Upload files on the Media library page. Videos are added as YouTube links.";
export const UPLOAD_NOTE_DISABLED =
  "File uploads are not set up yet. You can paste links for now; see README > Setting up Vercel Blob.";

/** Prominent note card about uploads (media library and editor). */
export function UploadNoteCard({ mode }: { mode: StorageMode }) {
  return (
    <div
      data-testid="upload-note"
      className="rounded-lg border border-gold/60 bg-beige/40 px-4 py-3 text-sm text-navy"
    >
      <p>
        <span className="font-semibold">Note: </span>
        {mode === "disabled" ? UPLOAD_NOTE_DISABLED : UPLOAD_NOTE_ENABLED}
      </p>
    </div>
  );
}
