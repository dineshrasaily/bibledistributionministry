/**
 * Where uploaded files go. Pure module.
 * - "blob": BLOB_READ_WRITE_TOKEN is set (Vercel Blob).
 * - "disabled": on Vercel without a token (its filesystem is read-only and
 *   ephemeral, so local files would vanish). Pasted links still work.
 * - "local": everywhere else (dev, tests): files under LOCAL_UPLOAD_DIR.
 */
export type StorageMode = "blob" | "local" | "disabled";

export function resolveStorageMode(
  env: Readonly<Record<string, string | undefined>>,
): StorageMode {
  if ((env.BLOB_READ_WRITE_TOKEN ?? "").trim() !== "") return "blob";
  if ((env.VERCEL ?? "").trim() !== "") return "disabled";
  return "local";
}
