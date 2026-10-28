"use client";

import { fitWithin } from "@/lib/uploads/policy";

export const IMAGE_DECODE_MSG =
  "This picture couldn't be read. Try a JPEG, PNG or WebP file.";

/**
 * Re-encodes a picture in the browser (same type, longest side <= 2560 px).
 * This strips EXIF/GPS location data and applies the phone's orientation.
 * Returns the new file plus its pixel size.
 */
export async function prepareImage(
  file: File,
  /** The allowed MIME type from classifyUpload. */
  mime: string,
): Promise<{ file: File; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(IMAGE_DECODE_MSG);
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(IMAGE_DECODE_MSG);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const type = mime;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, type === "image/png" ? undefined : 0.88),
  );
  if (!blob || blob.type !== type) throw new Error(IMAGE_DECODE_MSG);
  return { file: new File([blob], file.name, { type }), width, height };
}
