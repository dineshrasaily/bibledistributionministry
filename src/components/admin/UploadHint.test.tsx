import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  IMAGE_FIELD_HINT,
  MEDIA_LINK_HINTS,
  THUMBNAIL_HINT,
  UploadNoteCard,
} from "./UploadHint";

describe("upload hints (Phase 4-5 review NIT)", () => {
  it("image-only hints never suggest a YouTube link", () => {
    for (const hint of [
      IMAGE_FIELD_HINT,
      MEDIA_LINK_HINTS.IMAGE,
      MEDIA_LINK_HINTS.AUDIO,
    ]) {
      expect(hint).not.toMatch(/YouTube/i);
    }
    // The thumbnail hint only mentions YouTube to explain the privacy reason.
    expect(THUMBNAIL_HINT.startsWith(IMAGE_FIELD_HINT)).toBe(true);
    expect(THUMBNAIL_HINT).not.toMatch(/YouTube link/);
    expect(MEDIA_LINK_HINTS.VIDEO_EMBED).toMatch(/YouTube link/);
  });

  it("the note card tells the truth about the storage mode", () => {
    const { rerender } = render(<UploadNoteCard mode="local" />);
    expect(screen.getByTestId("upload-note")).toHaveTextContent("up to 8 MB");
    rerender(<UploadNoteCard mode="disabled" />);
    expect(screen.getByTestId("upload-note")).toHaveTextContent(
      "File uploads are not set up yet.",
    );
  });
});
