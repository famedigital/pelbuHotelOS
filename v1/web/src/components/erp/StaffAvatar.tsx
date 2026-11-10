"use client";

import { cloudinaryMediaThumbUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "size-9 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
} as const;

const SIZE_PX = {
  sm: 72,
  md: 80,
  lg: 112,
} as const;

export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

/** Desk-facing avatar: Cloudinary pass photo or initials fallback. */
export function StaffAvatar({
  name,
  publicId,
  size = "md",
  className,
}: {
  name: string;
  publicId: string | null | undefined;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const dim = SIZE_PX[size];
  const thumb = publicId
    ? cloudinaryMediaThumbUrl(publicId, "image", {
        width: dim,
        height: dim,
        crop: "fill",
      })
    : null;

  if (thumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivery URL
      <img
        src={thumb}
        alt=""
        width={dim}
        height={dim}
        className={cn(
          SIZE_CLASS[size],
          "shrink-0 rounded-full object-cover ring-1 ring-border",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        SIZE_CLASS[size],
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold tracking-wide text-muted-foreground ring-1 ring-border",
        className,
      )}
    >
      {staffInitials(name)}
    </span>
  );
}
