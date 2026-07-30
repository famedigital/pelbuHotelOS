"use client";

import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { CloudinaryVideo } from "@/components/media/CloudinaryVideo";
import type { CloudinaryResourceType } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

type Props = {
  publicId?: string | null;
  src?: string | null;
  alt: string;
  resourceType?: CloudinaryResourceType | string | null;
  posterPublicId?: string | null;
  ratio?: "16/10" | "16/9" | "4/3" | "3/2" | "1/1";
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  /** Hero / slideshow behaviour: autoplay muted loop without controls. */
  cinematic?: boolean;
  controls?: boolean;
  /** Pause inactive carousel slides. */
  active?: boolean;
};

const RATIO_CLASS: Record<NonNullable<Props["ratio"]>, string> = {
  "16/10": "aspect-[16/10]",
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "1/1": "aspect-square",
};

/**
 * Renders either a Cloudinary image or adaptive video in the same slot so
 * cards, galleries, and heroes can accept either media type.
 */
export function CloudinaryMedia({
  publicId,
  src,
  alt,
  resourceType = "image",
  posterPublicId,
  ratio,
  className,
  imgClassName,
  sizes,
  priority,
  fill,
  cinematic = false,
  controls,
  active = true,
}: Props) {
  const isVideo = resourceType === "video";
  const resolvedId = (publicId || "").trim();

  if (isVideo && resolvedId) {
    const video = (
      <CloudinaryVideo
        publicId={resolvedId}
        alt={alt}
        posterPublicId={posterPublicId}
        fill={Boolean(fill || ratio)}
        autoPlay={cinematic}
        muted={cinematic || !controls}
        loop={cinematic}
        controls={controls ?? !cinematic}
        videoClassName={imgClassName}
        active={active}
      />
    );
    if (ratio) {
      return (
        <div className={cn("relative overflow-hidden", RATIO_CLASS[ratio], className)}>
          {video}
        </div>
      );
    }
    return <div className={className}>{video}</div>;
  }

  return (
    <CloudinaryImage
      publicId={publicId}
      src={src}
      alt={alt}
      ratio={ratio}
      className={className}
      imgClassName={imgClassName}
      sizes={sizes}
      priority={priority}
      fill={fill}
    />
  );
}
