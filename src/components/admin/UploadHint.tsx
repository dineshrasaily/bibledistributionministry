// TODO(Phase 7): replace link fields with real uploads (Vercel Blob).
export const UPLOAD_HINT =
  "Uploading files arrives in a later update. For now, paste an image link or a YouTube link.";

export const MEDIA_UPLOAD_NOTE =
  "Uploading pictures and videos arrives in a later update. For now, paste an image link, an audio link or a YouTube link.";

/** Prominent note card shown at the top of the media editor. */
export function UploadNoteCard() {
  return (
    <div
      data-testid="upload-note"
      className="rounded-lg border border-gold/60 bg-beige/40 px-4 py-3 text-sm text-navy"
    >
      <p>
        <span className="font-semibold">Note: </span>
        {MEDIA_UPLOAD_NOTE}
      </p>
    </div>
  );
}
