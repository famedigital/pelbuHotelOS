"use client";

import {
  cloudinaryBlur,
  cloudinaryImageLoader,
  isCloudinarySource,
  parseCloudinaryUrl,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import Image from "next/image";
import type { CSSProperties } from "react";

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
  const resolved = (src || publicId || "").trim();
  if (!resolved) return null;

  const onCloudinary = isCloudinarySource(resolved);
  const blurId =
    !disableBlur && !priority
      ? resolved.startsWith("http")
        ? (parseCloudinaryUrl(resolved)?.publicId ?? null)
        : onCloudinary
          ? resolved
          : null
      : null;
  const blur = blurId ? (cloudinaryBlur(blurId) ?? undefined) : undefined;
  const useFill = Boolean(fill || ratio);
  const style: CSSProperties | undefined = objectPosition
    ? { objectPosition }
    : undefined;

  const image = (
    <Image
      alt={alt}
      src={resolved}
      loader={onCloudinary ? cloudinaryImageLoader : undefined}
      unoptimized={!onCloudinary}
      sizes={sizes}
      quality={quality}
      priority={priority}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
      className={cn(useFill && "object-cover", imgClassName)}
      style={style}
      {...(useFill
        ? { fill: true as const }
        : { width, height })}
    />
  );

  if (ratio) {
    return (
      <div className={cn("relative overflow-hidden", RATIO_CLASS[ratio], className)}>
        {image}
      </div>
    );
  }
  if (fill) {
    return <div className={cn("absolute inset-0", className)}>{image}</div>;
  }
  return <div className={className}>{image}</div>;
}
