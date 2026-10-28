/** What the server learns about a stored object before registering it. */
export type StoredObjectInfo = {
  size: number;
  /** Declared/stored content type (blob), or the extension's type (local). */
  contentType: string | null;
  /** The first bytes (for the magic-byte check). */
  head: Uint8Array;
};

export type StorageDriverName = "LOCAL" | "VERCEL_BLOB";

export type InspectedObject = {
  /** Local key or Vercel Blob pathname (stored in MediaItem.storageKey). */
  key: string;
  /** Public URL stored in MediaItem.url. */
  url: string;
  info: StoredObjectInfo;
};

export interface StorageDriver {
  readonly name: StorageDriverName;
  /** Looks up an uploaded object by its ref (local key or blob URL); null if unknown/unsafe. */
  inspect(ref: string): Promise<InspectedObject | null>;
  /** Deletes a stored object (missing objects are not an error). */
  remove(key: string, url: string): Promise<void>;
}
