import { CopyLinkButton } from "@/components/public/CopyLinkButton";
import { SiteImage } from "@/components/ui/SiteImage";
import type { MediaItem } from "@/generated/prisma/client";
import { formatBytes } from "@/lib/uploads/policy";
import { isSafeUrl } from "@/lib/validation/common";

/** Read-only details of an uploaded file (its type and link can't change). */
export function StoredFilePanel({ media }: { media: MediaItem }) {
  const url = media.url && isSafeUrl(media.url) ? media.url : null;
  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-beige bg-ivory p-4 sm:flex-row"
      data-testid="stored-file"
    >
      {url && media.type === "IMAGE" ? (
        <div className="relative aspect-[4/3] w-full max-w-xs shrink-0 overflow-hidden rounded-md bg-beige">
          <SiteImage
            src={url}
            alt={media.altTextEn ?? ""}
            fill
            sizes="20rem"
            className="object-contain"
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 text-sm text-navy">
        <h3 className="font-semibold">Stored file</h3>
        {url && media.type === "AUDIO" ? (
          <audio
            controls
            preload="metadata"
            src={url}
            className="w-full max-w-md"
          >
            <a href={url}>Download the audio file</a>
          </audio>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {media.originalFilename ? (
            <>
              <dt className="text-navy/75">Original name</dt>
              <dd className="break-all">{media.originalFilename}</dd>
            </>
          ) : null}
          <dt className="text-navy/75">Type</dt>
          <dd>{media.mimeType ?? "Unknown"}</dd>
          {media.sizeBytes != null ? (
            <>
              <dt className="text-navy/75">Size</dt>
              <dd>{formatBytes(media.sizeBytes)}</dd>
            </>
          ) : null}
          {media.width && media.height ? (
            <>
              <dt className="text-navy/75">Pixels</dt>
              <dd>
                {media.width} × {media.height}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="text-navy/75">
          Uploaded files keep their type and link. To replace the file, upload a
          new one and delete this item.
        </p>
        {url ? <StoredLink url={url} /> : null}
      </div>
    </div>
  );
}

function StoredLink({ url }: { url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="max-w-full rounded bg-white px-2 py-1 text-xs break-all">
        {url}
      </code>
      <CopyLinkLabel url={url} />
    </div>
  );
}

function CopyLinkLabel({ url }: { url: string }) {
  return (
    <CopyLinkButton
      url={url}
      labels={{
        copy: "Copy link",
        copied: "Link copied.",
        failed: "Copying failed. Select the link and copy it by hand.",
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy px-4 text-sm font-medium text-navy hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
    />
  );
}
