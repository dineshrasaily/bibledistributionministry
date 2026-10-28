"use client";

import {
  blobPathname,
  classifyUpload,
  type UploadKind,
} from "@/lib/uploads/policy";
import type { StorageMode } from "@/lib/storage-mode";

/** Browser side of the transfer step (local route or Vercel Blob client upload). */

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "This upload was blocked for security reasons. Reload the page and try again.",
  411: "The upload could not be read. Try again.",
  413: "This file is too large.",
  415: "This file type can't be uploaded.",
  503: "File uploads are not set up yet.",
};

export function messageForStatus(
  status: number,
  serverMessage?: string,
): string {
  if ((status === 413 || status === 415) && serverMessage) return serverMessage;
  return (
    STATUS_MESSAGES[status] ??
    "The upload failed. Check your connection and try again."
  );
}

export type UploadOptions = {
  mode: StorageMode;
  kind: UploadKind;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

function uploadLocal(
  file: File,
  { kind, onProgress, signal }: UploadOptions,
): Promise<{ ref: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/uploads/local?kind=${kind}`);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { key?: string; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status === 201 && body.key) {
        onProgress?.(100);
        resolve({ ref: body.key });
      } else {
        reject(
          new UploadError(
            messageForStatus(xhr.status, body.message),
            xhr.status,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new UploadError(messageForStatus(0)));
    xhr.onabort = () => reject(new UploadError("Upload cancelled."));
    if (signal) {
      if (signal.aborted) return xhr.abort();
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}

async function uploadBlob(
  file: File,
  { kind, onProgress, signal }: UploadOptions,
): Promise<{ ref: string }> {
  const check = classifyUpload({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    kind,
  });
  if (!check.ok) throw new UploadError(check.message);
  const { upload } = await import("@vercel/blob/client");
  try {
    const blob = await upload(blobPathname(kind, file.name, check.ext), file, {
      access: "public",
      handleUploadUrl: "/api/admin/uploads/blob",
      clientPayload: JSON.stringify({ kind }),
      contentType: check.mime,
      multipart: file.size > 5 * 1024 * 1024,
      abortSignal: signal,
      onUploadProgress: ({ percentage }) =>
        onProgress?.(Math.round(percentage)),
    });
    onProgress?.(100);
    return { ref: blob.url };
  } catch {
    if (signal?.aborted) throw new UploadError("Upload cancelled.");
    throw new UploadError(messageForStatus(0));
  }
}

/** Sends one (already validated) file; resolves with the ref to register. */
export function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<{ ref: string }> {
  if (options.mode === "local") return uploadLocal(file, options);
  if (options.mode === "blob") return uploadBlob(file, options);
  return Promise.reject(new UploadError(STATUS_MESSAGES[503]!, 503));
}
