import "server-only";
import path from "node:path";
import { log } from "@/lib/log";
import { resolveStorageMode, type StorageMode } from "@/lib/storage-mode";
import { createLocalStorage } from "./local";
import type { StorageDriver, StorageDriverName } from "./types";
import { createBlobStorage } from "./vercel-blob";

/** Read at call time so tests can stub the environment. */
export function getStorageMode(): StorageMode {
  return resolveStorageMode(process.env);
}

export function localUploadRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/
    process.cwd(),
    process.env.LOCAL_UPLOAD_DIR?.trim() || ".local/uploads",
  );
}

export function getLocalStorage() {
  return createLocalStorage(localUploadRoot());
}

/** The configured driver, or null when uploads are disabled. */
export function getStorage(): StorageDriver | null {
  const mode = getStorageMode();
  if (mode === "blob") {
    return createBlobStorage(process.env.BLOB_READ_WRITE_TOKEN!.trim());
  }
  if (mode === "local") return getLocalStorage();
  return null;
}

export type StoredFile = {
  driver: StorageDriverName;
  key: string;
  url: string;
};

/**
 * Deletes a media item's stored file after its row was deleted. If the
 * row's driver is not the one configured now (e.g. a LOCAL file after
 * switching to Blob) nothing is deleted. Errors are logged and rethrown
 * (runAdminAction's afterCommit swallows them: an orphan file is harmless).
 */
export async function removeStoredFile(
  stored: StoredFile | null | undefined,
): Promise<void> {
  if (!stored) return;
  const storage = getStorage();
  if (!storage || storage.name !== stored.driver) {
    log.warn("media.file.delete_skipped", { driver: stored.driver });
    return;
  }
  try {
    await storage.remove(stored.key, stored.url);
  } catch (error) {
    log.error("media.file.delete_failed", {
      driver: stored.driver,
      key: stored.key,
      name: (error as Error)?.name,
    });
    throw error;
  }
}
