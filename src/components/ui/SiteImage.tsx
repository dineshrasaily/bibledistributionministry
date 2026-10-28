import Image from "next/image";
import { isOptimizableSrc } from "@/lib/image-src";

type Common = {
  src: string;
  /** "" for decorative images. */
  alt: string;
  className?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
};

type FillProps = Common & {
  /** The parent must be `relative` and sized (e.g. an aspect-ratio box). */
  fill: true;
  sizes: string;
  width?: never;
  height?: never;
};
type SizedProps = Common & {
  fill?: false;
  width: number;
  height: number;
  sizes?: string;
};
type PlainProps = Common & {
  fill?: false;
  width?: null;
  height?: null;
  sizes?: never;
};

export type SiteImageProps = FillProps | SizedProps | PlainProps;

/**
 * next/image wrapper for public and admin pictures. Only Vercel Blob media
 * URLs and raster /brand/ or /demo/ files go through the optimizer; SVGs,
 * local dev uploads (/api/uploads/...) and other https hosts are rendered
 * unoptimized. Without `fill` or a known size it falls back to a plain <img>.
 */
export function SiteImage(props: SiteImageProps) {
  const { src, alt, className, priority, loading } = props;
  const unoptimized = !isOptimizableSrc(src);
  if (props.fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={props.sizes}
        className={className}
        unoptimized={unoptimized}
        priority={priority}
        loading={priority ? undefined : loading}
      />
    );
  }
  if (props.width && props.height) {
    return (
      <Image
        src={src}
        alt={alt}
        width={props.width}
        height={props.height}
        sizes={props.sizes}
        className={className}
        unoptimized={unoptimized}
        priority={priority}
        loading={priority ? undefined : loading}
      />
    );
  }
  return (
    // Unknown size: a plain <img> (the only no-img-element use outside the header/footer logo).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : (loading ?? "lazy")}
      decoding="async"
    />
  );
}
