// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  galleryAddItemsSchema,
  galleryMoveSchema,
  gallerySchema,
} from "./galleries";
import { libraryQuerySchema, registerUploadSchema } from "./uploads";

const image = {
  kind: "IMAGE",
  ref: "media/images/2026/10/a-abcdefghij.png",
  titleEn: "  A photo  ",
  altTextEn: "Two people reading",
};

describe("registerUploadSchema", () => {
  it("requires alt text for pictures only", () => {
    const missing = registerUploadSchema.safeParse({
      ...image,
      altTextEn: "  ",
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["altTextEn"]);
    const audio = registerUploadSchema.parse({
      kind: "AUDIO",
      ref: "media/audio/2026/10/a-abcdefghij.mp3",
      titleEn: "Talk",
      altTextEn: "ignored",
    });
    expect("altTextEn" in audio).toBe(false);
  });

  it("trims, defaults and bounds the fields", () => {
    const parsed = registerUploadSchema.parse({
      ...image,
      width: "",
      height: "240",
      publish: "on",
    });
    expect(parsed).toMatchObject({
      titleEn: "A photo",
      width: null,
      height: 240,
      galleryId: null,
      publish: true,
    });
    expect(
      registerUploadSchema.safeParse({ ...image, width: "0" }).success,
    ).toBe(false);
    expect(
      registerUploadSchema.safeParse({ ...image, width: "10001" }).success,
    ).toBe(false);
    expect(
      registerUploadSchema.safeParse({ ...image, titleEn: "x".repeat(161) })
        .success,
    ).toBe(false);
    expect(
      registerUploadSchema.safeParse({ ...image, altTextEn: "x".repeat(301) })
        .success,
    ).toBe(false);
    expect(
      registerUploadSchema.safeParse({ ...image, galleryId: "Bad Id!" })
        .success,
    ).toBe(false);
    expect(
      registerUploadSchema.safeParse({ ...image, kind: "VIDEO" }).success,
    ).toBe(false);
    expect(registerUploadSchema.safeParse({ ...image, ref: "" }).success).toBe(
      false,
    );
  });
});

describe("libraryQuerySchema", () => {
  it("falls back to defaults on invalid values", () => {
    expect(
      libraryQuerySchema.parse({ kind: "video", page: "-3", q: "  " }),
    ).toEqual({
      kind: "image",
      page: 1,
      q: undefined,
    });
    expect(
      libraryQuerySchema.parse({ kind: "audio", page: "2", q: "hope" }),
    ).toEqual({
      kind: "audio",
      page: 2,
      q: "hope",
    });
  });
});

describe("gallery schemas", () => {
  it("validates gallery fields and the optional event", () => {
    expect(
      gallerySchema.parse({ titleEn: "Trip", eventId: "", intent: "draft" })
        .eventId,
    ).toBeNull();
    expect(
      gallerySchema.safeParse({ titleEn: "", intent: "draft" }).success,
    ).toBe(false);
    expect(
      gallerySchema.safeParse({
        titleEn: "T",
        descriptionEn: "x".repeat(1001),
        intent: "draft",
      }).success,
    ).toBe(false);
  });

  it("needs 1 to 50 unique picture ids", () => {
    expect(
      galleryAddItemsSchema.safeParse({ galleryId: "g1", mediaIds: [] })
        .success,
    ).toBe(false);
    expect(
      galleryAddItemsSchema.parse({
        galleryId: "g1",
        mediaIds: ["a", "a", "b"],
      }).mediaIds,
    ).toEqual(["a", "b"]);
    const many = Array.from({ length: 51 }, (_, i) => `m${i}`);
    expect(
      galleryAddItemsSchema.safeParse({ galleryId: "g1", mediaIds: many })
        .success,
    ).toBe(false);
  });

  it("only moves up or down", () => {
    expect(
      galleryMoveSchema.safeParse({
        galleryId: "g",
        mediaId: "m",
        direction: "left",
      }).success,
    ).toBe(false);
  });
});
