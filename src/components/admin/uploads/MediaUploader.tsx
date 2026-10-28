"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/cn";
import type { StorageMode } from "@/lib/storage-mode";
import {
  acceptAttribute,
  classifyUpload,
  formatBytes,
  LIMITS_TEXT,
  MAX_FILES_PER_BATCH,
  titleFromFilename,
  type UploadCheck,
} from "@/lib/uploads/policy";
import { registerUploadAction } from "@/server/actions/uploads";
import type { UploadedMedia } from "@/server/services/uploads";
import { UploadNoteCard } from "../UploadHint";
import { prepareImage } from "./prepare-image";
import { uploadFile, UploadError } from "./upload-client";

type Status = "ready" | "uploading" | "done" | "error";

type Item = {
  id: string;
  file: File;
  check: UploadCheck;
  preview: string | null;
  title: string;
  altEn: string;
  altNe: string;
  publish: boolean;
  status: Status;
  progress: number;
  error: string | null;
};

const BATCH_MSG = `You can upload at most ${MAX_FILES_PER_BATCH} files at a time. The rest were not added.`;

function AudioIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-10 text-gold-dark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

let seq = 0;

/**
 * Drag-and-drop + file picker uploader for pictures and audio. Files are
 * checked against the allow-list in the browser first (the server checks
 * again), pictures are re-encoded (location data removed), then each file
 * is sent with a progress bar and registered through the guarded action.
 */
export function MediaUploader({
  mode,
  accept = "image+audio",
  multiple = true,
  galleryId,
  defaultPublish = false,
  onUploaded,
  refreshOnSuccess = false,
}: {
  mode: StorageMode;
  accept?: "image" | "image+audio";
  multiple?: boolean;
  galleryId?: string;
  defaultPublish?: boolean;
  onUploaded?: (item: UploadedMedia) => void;
  /** Refresh the server-rendered page after each successful upload. */
  refreshOnSuccess?: boolean;
}) {
  const baseId = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRefs = useRef(new Map<string, HTMLElement | null>());
  const abortRef = useRef<AbortController | null>(null);
  const announced = useRef(-1);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const maxFiles = multiple ? MAX_FILES_PER_BATCH : 1;

  // Revoke preview URLs when the component unmounts.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item.preview) URL.revokeObjectURL(item.preview);
      }
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  function addFiles(list: FileList | File[]) {
    const files = [...list];
    const open = items.filter((i) => i.status !== "done");
    const room = Math.max(0, maxFiles - open.length);
    setNotice(files.length > room ? (multiple ? BATCH_MSG : null) : null);
    const accepted = files.slice(0, multiple ? room : 1);
    const next: Item[] = accepted.map((file) => {
      const check = classifyUpload({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        kind: accept === "image" ? "IMAGE" : undefined,
      });
      return {
        id: `${baseId}-${(seq += 1)}`,
        file,
        check,
        preview:
          check.ok &&
          check.kind === "IMAGE" &&
          typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(file)
            : null,
        title: titleFromFilename(file.name),
        altEn: "",
        altNe: "",
        publish: defaultPublish,
        status: check.ok ? "ready" : "error",
        progress: 0,
        error: check.ok ? null : check.message,
      };
    });
    setItems((all) => (multiple ? [...all, ...next] : next));
  }

  function removeItem(id: string) {
    setItems((all) => {
      const gone = all.find((i) => i.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return all.filter((i) => i.id !== id);
    });
  }

  const pending = items.filter((i) => i.status === "ready");
  const isComplete = (i: Item) =>
    i.check.ok &&
    i.title.trim() !== "" &&
    (i.check.kind !== "IMAGE" || i.altEn.trim() !== "");
  const canUpload = !busy && pending.length > 0 && pending.every(isComplete);

  function announce(name: string, percent: number) {
    const step = Math.floor(percent / 25) * 25;
    if (step !== announced.current) {
      announced.current = step;
      setLive(`Uploading ${name}: ${step}%`);
    }
  }

  async function uploadOne(item: Item): Promise<boolean> {
    if (!item.check.ok) return false;
    const { kind, mime } = item.check;
    const controller = new AbortController();
    abortRef.current = controller;
    announced.current = -1;
    update(item.id, { status: "uploading", progress: 0, error: null });
    announce(item.file.name, 0);
    try {
      let file = item.file;
      let width: number | null = null;
      let height: number | null = null;
      if (kind === "IMAGE") {
        ({ file, width, height } = await prepareImage(item.file, mime));
      }
      const { ref } = await uploadFile(file, {
        mode,
        kind,
        signal: controller.signal,
        onProgress: (p) => {
          update(item.id, { progress: p });
          announce(item.file.name, p);
        },
      });
      const form = new FormData();
      form.set("kind", kind);
      form.set("ref", ref);
      form.set("titleEn", item.title);
      form.set("originalFilename", item.file.name);
      if (kind === "IMAGE") {
        form.set("altTextEn", item.altEn);
        form.set("altTextNe", item.altNe);
        if (width && height) {
          form.set("width", String(width));
          form.set("height", String(height));
        }
      }
      if (galleryId) form.set("galleryId", galleryId);
      if (item.publish) form.set("publish", "on");
      const result = await registerUploadAction(null, form);
      if (!result.ok) {
        if (result.code === "UNAUTHENTICATED") {
          throw new UploadError(
            "Your session has expired. Please sign in again.",
          );
        }
        const field = result.fieldErrors
          ? Object.values(result.fieldErrors)[0]
          : undefined;
        throw new UploadError(
          field ?? result.formError ?? "The upload failed.",
        );
      }
      update(item.id, { status: "done", progress: 100 });
      setLive(`Uploaded ${item.file.name}.`);
      if (result.data) onUploaded?.(result.data);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The upload failed.";
      update(item.id, { status: "ready", progress: 0, error: message });
      setLive(`${item.file.name}: ${message}`);
      requestAnimationFrame(() => errorRefs.current.get(item.id)?.focus());
      return false;
    } finally {
      abortRef.current = null;
    }
  }

  async function uploadAll() {
    setBusy(true);
    let any = false;
    for (const item of pending) {
      if (!isComplete(item)) continue;
      const ok = await uploadOne(item);
      any ||= ok;
      if (!ok) break;
    }
    setBusy(false);
    if (any && refreshOnSuccess) router.refresh();
  }

  if (mode === "disabled") return <UploadNoteCard mode="disabled" />;

  const inputId = `${baseId}-input`;
  const limitsId = `${baseId}-limits`;
  const what = accept === "image" ? "pictures" : "pictures or audio";

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="media-uploader">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
        data-testid="drop-zone"
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-gold-dark bg-beige/60" : "border-navy/30 bg-ivory",
        )}
      >
        <p className="text-base text-navy">
          {dragging ? `Drop ${what} to add them` : `Drag ${what} here, or`}
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={acceptAttribute(accept)}
          multiple={multiple}
          aria-describedby={limitsId}
          className="peer sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-navy px-6 font-medium text-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-gold-dark hover:bg-navy/5"
        >
          {multiple ? "Choose files" : "Choose a file"}
        </label>
        <p id={limitsId} className="text-sm text-navy/75">
          {accept === "image" ? "JPEG, PNG or WebP up to 8 MB." : LIMITS_TEXT}{" "}
          Location data is removed from photos.
        </p>
      </div>

      {notice ? (
        <p role="alert" className="text-sm font-medium text-red-800">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-4" aria-label="Files to upload">
          {items.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              busy={busy}
              onChange={(patch) => update(item.id, patch)}
              onRemove={() => removeItem(item.id)}
              onCancel={() => abortRef.current?.abort()}
              errorRef={(el) => {
                errorRefs.current.set(item.id, el);
              }}
            />
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={uploadAll} disabled={!canUpload}>
            {busy
              ? "Uploading…"
              : pending.length > 1
                ? `Upload ${pending.length} files`
                : "Upload"}
          </Button>
          {!canUpload && !busy ? (
            <p className="text-sm text-navy/75">
              Fill in the title and the picture description of each file first.
            </p>
          ) : null}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only" data-testid="upload-live">
        {live}
      </p>
    </div>
  );
}

function FileCard({
  item,
  busy,
  onChange,
  onRemove,
  onCancel,
  errorRef,
}: {
  item: Item;
  busy: boolean;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
  onCancel: () => void;
  errorRef: (el: HTMLElement | null) => void;
}) {
  const id = item.id.replace(/[^A-Za-z0-9_-]/g, "");
  const isImage = item.check.ok && item.check.kind === "IMAGE";
  const editable = item.status === "ready" && !busy;
  const errorId = `${id}-error`;
  return (
    <li
      className="flex flex-col gap-4 rounded-lg border border-beige bg-white p-4 sm:flex-row"
      data-testid="upload-card"
    >
      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-beige">
        {item.preview ? (
          // Local object URL preview (never optimized).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.preview} alt="" className="size-full object-cover" />
        ) : item.check.ok ? (
          <AudioIcon />
        ) : (
          <span aria-hidden="true" className="text-3xl text-navy/50">
            ✕
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm text-navy/80">
          <span className="font-semibold break-all text-navy">
            {item.file.name}
          </span>{" "}
          · {formatBytes(item.file.size)}
          {item.check.ok ? ` · ${isImage ? "Picture" : "Audio"}` : null}
        </p>

        {!item.check.ok ? (
          <p
            id={errorId}
            role="alert"
            className="text-sm font-medium text-red-800"
          >
            {item.check.message} This file will not be uploaded.
          </p>
        ) : item.status === "done" ? (
          <p className="text-sm font-semibold text-green-800" role="status">
            Uploaded.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor={`${id}-title`} required>
                Title
              </Label>
              <Input
                id={`${id}-title`}
                value={item.title}
                maxLength={160}
                disabled={!editable}
                onChange={(e) => onChange({ title: e.target.value })}
                className="mt-1.5"
                aria-required
              />
            </div>
            {isImage ? (
              <>
                <div>
                  <Label htmlFor={`${id}-alt-en`} required>
                    Picture description (alt text) (English)
                  </Label>
                  <Input
                    id={`${id}-alt-en`}
                    value={item.altEn}
                    maxLength={300}
                    disabled={!editable}
                    onChange={(e) => onChange({ altEn: e.target.value })}
                    className="mt-1.5"
                    aria-required
                    aria-describedby={`${id}-alt-hint`}
                  />
                  <p
                    id={`${id}-alt-hint`}
                    className="mt-1.5 text-sm text-navy/75"
                  >
                    Describe the picture for people who can&apos;t see it.
                  </p>
                </div>
                <div>
                  <Label htmlFor={`${id}-alt-ne`}>
                    Picture description (alt text) (नेपाली, Nepali)
                  </Label>
                  <Input
                    id={`${id}-alt-ne`}
                    lang="ne"
                    value={item.altNe}
                    maxLength={300}
                    disabled={!editable}
                    onChange={(e) => onChange({ altNe: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </>
            ) : null}
            <Checkbox
              id={`${id}-publish`}
              label="Publish on the public site"
              checked={item.publish}
              disabled={!editable}
              onChange={(e) => onChange({ publish: e.target.checked })}
            />
            {item.status === "uploading" ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${id}-progress`}
                  className="text-sm font-medium text-navy"
                >
                  Uploading… {item.progress}%
                </label>
                <progress
                  id={`${id}-progress`}
                  max={100}
                  value={item.progress}
                  className="h-2 w-full accent-navy"
                />
              </div>
            ) : null}
            {item.error ? (
              <p
                id={errorId}
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="text-sm font-medium text-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"
              >
                {item.error}
              </p>
            ) : null}
          </>
        )}
        {item.status === "uploading" ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={onCancel}
            >
              Cancel upload
            </Button>
          </div>
        ) : item.status !== "done" && !busy ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={onRemove}
              aria-label={`Remove ${item.file.name}`}
            >
              Remove
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
