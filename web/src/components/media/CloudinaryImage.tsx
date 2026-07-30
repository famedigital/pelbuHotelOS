"use client";

import {
  cloudinaryBlur,
  cloudinaryImageLoader,
  isCloudinarySource,
  parseCloudinaryUrl,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import Image from "next/image";

type Props = {
  /** Cloudinary public_id, absolute URL, or local path. */
  publicId?: string | null;
  src?: string | null;
  alt: string;
  ratio?: "16/10" | "16/9" | "4/3" | "3/2" | "1/1";
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  fill?: boolean;
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
 * loader (srcset + dpr). Absolute/local URLs pass through unchanged.
 */
export function CloudinaryImage({
  publicId,
  src,
  alt,
  ratio,
  className,
  imgClassName,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  width = 1200,
  height = 800,
  fill,
}: Props) {
  const resolved = (src || publicId || "").trim();
  if (!resolved) return null;

  const onCloudinary = isCloudinarySource(resolved);
  const blurId = resolved.startsWith("http")
    ? (parseCloudinaryUrl(resolved)?.publicId ?? null)
    : onCloudinary
      ? resolved
      : null;
  const blur = blurId ? (cloudinaryBlur(blurId) ?? undefined) : undefined;
  const useFill = Boolean(fill || ratio);

  const image = (
    <Image
      alt={alt}
      src={resolved}
      loader={onCloudinary ? cloudinaryImageLoader : undefined}
      unoptimized={!onCloudinary}
      sizes={sizes}
      priority={priority}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
      className={cn(useFill && "object-cover", imgClassName)}
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
