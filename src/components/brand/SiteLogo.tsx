import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

/**
 * Only same-site paths ("/brand/x.png", not "//host") and https URLs are
 * rendered. The URL was already checked by isSafeUrl when it was saved; this
 * is defence in depth.
 */
function displayableLogoUrl(url: string | null | undefined): string | null {
  const value = url?.trim() ?? "";
  if (value === "") return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("https://")) return value;
  return null;
}

/**
 * The site logo from Settings (logoUrl), or the built-in placeholder mark.
 * Always decorative: the ministry name is shown as text next to it.
 * Used by the footer and the admin; the public header keeps its own markup.
 */
export function SiteLogo({
  logoUrl,
  className,
  fallbackClassName,
}: {
  logoUrl: string | null | undefined;
  /** Classes for the uploaded image (height + max width). */
  className?: string;
  /** Classes for the placeholder SVG (square size). */
  fallbackClassName?: string;
}) {
  const src = displayableLogoUrl(logoUrl);
  if (!src) return <Logo decorative className={fallbackClassName} />;
  return (
    // A small, fixed-size logo whose URL may be any https host: plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      decoding="async"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
