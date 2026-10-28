"use client";

import { useState } from "react";
import { BilingualField } from "./BilingualField";
import { SelectField, TextField } from "./fields";
import { MEDIA_TYPE_LABELS, optionsOf } from "./labels";
import { MEDIA_LINK_HINTS } from "./UploadHint";

type MediaType = keyof typeof MEDIA_TYPE_LABELS;

/** Type select that switches between link, YouTube and alt-text fields. */
export function MediaTypeFields({
  defaultType = "IMAGE",
  url,
  embedUrl,
  altTextEn,
  altTextNe,
  locked = false,
}: {
  defaultType?: MediaType;
  url?: string | null;
  embedUrl?: string | null;
  altTextEn?: string | null;
  altTextNe?: string | null;
  /** Uploaded file: type and link are fixed (shown in the Stored file panel). */
  locked?: boolean;
}) {
  const [type, setType] = useState<MediaType>(defaultType);

  if (locked) {
    return (
      <>
        <input type="hidden" name="type" value={defaultType} />
        <input type="hidden" name="url" value={url ?? ""} />
        {defaultType === "IMAGE" ? (
          <BilingualField
            name="altText"
            label="Image description (alt text)"
            required
            maxLength={300}
            defaultEn={altTextEn}
            defaultNe={altTextNe}
            hint="Describe the picture for people who can't see it."
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <SelectField
        name="type"
        label="Media type"
        options={optionsOf(MEDIA_TYPE_LABELS)}
        value={type}
        onChange={(e) => setType(e.target.value as MediaType)}
        required
      />
      {type === "VIDEO_EMBED" ? (
        <div className="flex flex-col gap-2">
          <TextField
            name="embedUrl"
            label="YouTube link"
            type="url"
            inputMode="url"
            defaultValue={embedUrl ?? ""}
            placeholder="https://www.youtube.com/watch?v=…"
            hint={MEDIA_LINK_HINTS.VIDEO_EMBED}
            required
          />
          {embedUrl ? (
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-navy underline underline-offset-2"
            >
              Open the current video in a new tab
            </a>
          ) : null}
        </div>
      ) : (
        <TextField
          name="url"
          label={type === "IMAGE" ? "Image link" : "Audio link"}
          type="url"
          inputMode="url"
          defaultValue={url ?? ""}
          placeholder="https://"
          hint={MEDIA_LINK_HINTS[type]}
          required
        />
      )}
      {type === "IMAGE" ? (
        <BilingualField
          name="altText"
          label="Image description (alt text)"
          required
          maxLength={300}
          defaultEn={altTextEn}
          defaultNe={altTextNe}
          hint="Describe the picture for people who can't see it."
        />
      ) : null}
    </>
  );
}
