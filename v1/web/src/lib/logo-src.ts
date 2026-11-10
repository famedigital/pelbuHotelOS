import { BRAND_ICONS } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";

/**
 * Client-safe: map Cloudinary public_id (or empty) → deliverable logo URL.
 * Keep server loaders in `public-logo.ts` so Client Components never pull
 * `next/headers` via tenant resolution.
 */
export function resolveLogoSrc(logoPublicId: string | null | undefined): string {
  if (logoPublicId?.trim()) {
    return (
      cloudinaryUrl(logoPublicId.trim(), {
        width: 192,
        height: 192,
        crop: "fit",
      }) ?? BRAND_ICONS.mark
    );
  }
  return BRAND_ICONS.mark;
}
