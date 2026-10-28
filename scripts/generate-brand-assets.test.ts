// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { generateBrandAssets } from "./generate-brand-assets";

const ROOT = process.cwd();
const COMMITTED = {
  icon: path.join(ROOT, "src/app/icon.png"),
  appleIcon: path.join(ROOT, "src/app/apple-icon.png"),
  ogImage: path.join(ROOT, "public/brand/og-default.png"),
};

describe("brand assets", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "brand-assets-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it.each([
    ["icon", COMMITTED.icon, 512, 512],
    ["apple-icon", COMMITTED.appleIcon, 180, 180],
    ["og-default", COMMITTED.ogImage, 1200, 630],
  ])("%s is a %sx%s PNG", async (_name, file, width, height) => {
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(width);
    expect(meta.height).toBe(height);
  });

  it("apple-icon is opaque (iOS fills transparency with black)", async () => {
    const meta = await sharp(COMMITTED.appleIcon).metadata();
    expect(meta.hasAlpha).toBe(false);
  });

  it("the placeholder icon.svg is gone", () => {
    expect(existsSync(path.join(ROOT, "src/app/icon.svg"))).toBe(false);
  });

  it("regenerating gives byte-identical files", async () => {
    const out = await generateBrandAssets({ root: ROOT, outDir: tmp });
    for (const key of ["icon", "appleIcon", "ogImage"] as const) {
      expect(
        readFileSync(out[key]).equals(readFileSync(COMMITTED[key])),
        key,
      ).toBe(true);
    }
  }, 30_000);
});
