/**
 * Generates the app icons and the default Open Graph image from the user's
 * logo files (public/brand/logo-mark.png and logo-full.png).
 *
 *   npm run brand:generate
 *
 * The outputs are committed, so builds and Vercel never need to run this.
 * Run it again only after replacing a logo file.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp, { type Sharp } from "sharp";

/** Brand ivory (bg-ivory) and decorative gold (#B8924A). */
const IVORY = "#FBF8F3";
const GOLD = "#B8924A";

export type BrandAssetPaths = {
  icon: string;
  appleIcon: string;
  ogImage: string;
};

/** Deterministic PNG output: max compression, no palette, no metadata. */
const png = (image: Sharp) =>
  image.png({ compressionLevel: 9, palette: false });

/** The logo, scaled to fit `width` x `height` on a transparent canvas. */
async function fitted(
  source: string,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(source)
    .resize(width, height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/** A square icon: the mark centred on ivory at `scale` of the width. */
async function squareIcon(
  mark: string,
  size: number,
  scale: number,
  out: string,
): Promise<void> {
  const inner = Math.round(size * scale);
  const logo = await fitted(mark, inner, inner);
  await png(
    sharp({
      create: { width: size, height: size, channels: 3, background: IVORY },
    })
      .composite([{ input: logo, gravity: "centre" }])
      // Opaque output: iOS fills transparency with black.
      .flatten({ background: IVORY })
      .removeAlpha(),
  ).toFile(out);
}

export async function generateBrandAssets({
  root,
  outDir,
}: {
  root: string;
  /** Write every file here instead of the real locations (tests). */
  outDir?: string;
}): Promise<BrandAssetPaths> {
  const mark = path.join(root, "public/brand/logo-mark.png");
  const full = path.join(root, "public/brand/logo-full.png");
  const paths: BrandAssetPaths = outDir
    ? {
        icon: path.join(outDir, "icon.png"),
        appleIcon: path.join(outDir, "apple-icon.png"),
        ogImage: path.join(outDir, "og-default.png"),
      }
    : {
        icon: path.join(root, "src/app/icon.png"),
        appleIcon: path.join(root, "src/app/apple-icon.png"),
        ogImage: path.join(root, "public/brand/og-default.png"),
      };
  for (const file of Object.values(paths)) {
    await mkdir(path.dirname(file), { recursive: true });
  }

  await squareIcon(mark, 512, 0.88, paths.icon);
  await squareIcon(mark, 180, 0.84, paths.appleIcon);

  // Open Graph: the full logo (it carries the ministry name) centred on
  // ivory, with a thin gold bar along the bottom edge.
  const ogLogo = await fitted(full, 1100, 460);
  const goldBar = await sharp({
    create: { width: 1200, height: 6, channels: 3, background: GOLD },
  })
    .png()
    .toBuffer();
  await png(
    sharp({
      create: { width: 1200, height: 630, channels: 3, background: IVORY },
    })
      .composite([
        { input: ogLogo, gravity: "centre" },
        { input: goldBar, left: 0, top: 624 },
      ])
      .flatten({ background: IVORY })
      .removeAlpha(),
  ).toFile(paths.ogImage);

  return paths;
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  generateBrandAssets({ root: process.cwd() })
    .then((paths) => {
      for (const file of Object.values(paths)) {
        console.log(`Wrote ${path.relative(process.cwd(), file)}`);
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
