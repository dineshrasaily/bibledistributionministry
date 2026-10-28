/**
 * Which image sources go through the Next.js image optimizer. Pure module.
 * Only Vercel Blob media URLs (listed in next.config remotePatterns) and the
 * raster brand/demo files are optimized; everything else (SVG, local dev
 * uploads under /api/uploads, other https hosts) is rendered unoptimized.
 */

const BLOB_HOST_RE = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/;
const OPTIMIZABLE_SITE_PATH_RE =
  /^\/(brand|demo)\/[A-Za-z0-9/_-]+(\.[A-Za-z0-9_-]+)*\.(png|jpe?g|webp)$/i;

/** https URL on a public Vercel Blob store (no credentials, port or query). */
export function isBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    BLOB_HOST_RE.test(parsed.hostname) &&
    parsed.port === "" &&
    parsed.username === "" &&
    parsed.password === ""
  );
}

export function isOptimizableSrc(src: string): boolean {
  if (src.startsWith("/")) {
    return !src.includes("..") && OPTIMIZABLE_SITE_PATH_RE.test(src);
  }
  if (!isBlobUrl(src)) return false;
  const parsed = new URL(src);
  return parsed.search === "" && parsed.pathname.startsWith("/media/");
}
