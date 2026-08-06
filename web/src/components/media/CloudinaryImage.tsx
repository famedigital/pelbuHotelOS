"use client";

import {
  cloudinaryBlur,
  cloudinaryImageLoader,
  cloudinaryUrl,
  getCloudinaryCloudName,
  isCloudinarySource,
  parseCloudinaryUrl,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

type Props = {
  /** Cloudinary public_id, absolute URL, or local path. */
  publicId?: string | null;
  src?: string | null;
  alt: string;
  ratio?: "16/10" | "16/9" | "4/3" | "3/2" | "1/1";
  className?: string;
  imgClassName?: string;
  /** CSS object-position for fill/cover heroes (e.g. "50% 20%"). */
  objectPosition?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  fill?: boolean;
  /**
   * Next → Cloudinary quality. Default 85 (maps to auto:best for large widths).
   * Heroes should pass 90–95 for dense retina.
   */
  quality?: number;
  /** Skip blur-up placeholder (preferred for full-bleed heroes). */
  disableBlur?: boolean;
};

const RATIO_CLASS: Record<NonNullable<Props["ratio"]>, string> = {
  "16/10": "aspect-[16/10]",
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "1/1": "aspect-square",
};

/**
 * Always hand next/image an absolute URL (or local path) — never a bare
 * Cloudinary public_id, which browsers resolve as `/{public_id}` on the app
 * host and paint the broken-image glyph (what guests saw on Rooms/Gallery).
 */
function resolveDeliverySrc(
  publicId: string | null | undefined,
  src: string | null | undefined,
  width: number,
): string | null {
  const raw = (src || publicId || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const built = cloudinaryUrl(raw, {
    width: Math.max(width, 960),
    crop: "limit",
  });
  if (built) return built;

  const cloud = getCloudinaryCloudName();
  if (!cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${Math.max(width, 960)},c_limit/${raw.replace(/^\//, "")}`;
}

function simpleFallbackUrl(source: string, width: number): string | null {
  if (source.startsWith("/")) return source;
  if (source.startsWith("http")) {
    const parsed = parseCloudinaryUrl(source);
    if (!parsed) return source;
    return (
      cloudinaryUrl(parsed.publicId, {
        width: Math.max(width, 800),
        crop: "limit",
      }) ??
      `https://res.cloudinary.com/${parsed.cloud}/image/upload/f_auto,q_auto,w_800,c_limit/${parsed.publicId}`
    );
  }
  return cloudinaryUrl(source, { width: Math.max(width, 800), crop: "limit" });
}

/**
 * Public photography component. Cloudinary public IDs go through the custom
 * loader (srcset + dense retina widths). Absolute/local URLs pass through.
 */
export function CloudinaryImage({
  publicId,
  src,
  alt,
  ratio,
  className,
  imgClassName,
  objectPosition,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  width = 1200,
  height = 800,
  fill,
  quality = 85,
  disableBlur = false,
}: Props) {
  const primary = useMemo(
    () => resolveDeliverySrc(publicId, src, width),
    [publicId, src, width],
  );
  const [deliverySrc, setDeliverySrc] = useState<string | null>(primary);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    setDeliverySrc(primary);
    setUsedFallback(false);
  }, [primary]);

  const onCloudinary = deliverySrc ? isCloudinarySource(deliverySrc) : false;
  const blurId =
    !disableBlur && !priority && deliverySrc && !usedFallback
      ? deliverySrc.startsWith("http")
        ? (parseCloudinaryUrl(deliverySrc)?.publicId ?? null)
        : onCloudinary
          ? deliverySrc
          : null
      : null;
  const blur = blurId ? (cloudinaryBlur(blurId) ?? undefined) : undefined;
  const useFill = Boolean(fill || ratio);
  const style: CSSProperties | undefined = objectPosition
    ? { objectPosition }
    : undefined;

  const handleError = useCallback(() => {
    if (!deliverySrc || usedFallback) return;
    const next = simpleFallbackUrl(deliverySrc, width);
    if (next && next !== deliverySrc) {
      setUsedFallback(true);
      setDeliverySrc(next);
    }
  }, [deliverySrc, usedFallback, width]);

  if (!deliverySrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary px-3 text-center text-xs text-muted-foreground",
          ratio && RATIO_CLASS[ratio],
          className,
        )}
        role="img"
        aria-label={alt || "Image unavailable"}
      >
        {alt || "Photo coming soon"}
      </div>
    );
  }

  const image = (
    <Image
      alt={alt}
      src={deliverySrc}
      loader={onCloudinary ? cloudinaryImageLoader : undefined}
      unoptimized={!onCloudinary || usedFallback}
      sizes={sizes}
      quality={quality}
      priority={priority}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
      className={cn(useFill && "object-cover", imgClassName)}
      style={style}
      onError={handleError}
      {...(useFill
        ? { fill: true as const }
        : { width, height })}
    />
  );

  if (ratio) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-secondary",
          RATIO_CLASS[ratio],
          className,
        )}
      >
        {image}
      </div>
    );
  }
  if (fill) {
    return (
      <div className={cn("absolute inset-0 bg-secondary", className)}>{image}</div>
    );
  }
  return <div className={cn("bg-secondary", className)}>{image}</div>;
}
