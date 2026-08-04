import { BRAND_ICONS } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadPublicPropertyProfile } from "@/lib/public-property";

/**
 * Public chrome logo: Settings → Identity Cloudinary logo when set,
 * otherwise the versioned local PWA mark under `web/public/icons`.
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

/** Load the property logo for public shells (header / footer fallbacks). */
export async function loadPublicLogoSrc(): Promise<string> {
  const property = await loadPublicPropertyProfile();
  return resolveLogoSrc(property?.logoPublicId);
}
