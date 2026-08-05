import { BRAND_CLOUDINARY } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import type { Metadata } from "next";

export type ShareImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Absolute 1200×630 JPEG for WhatsApp / Facebook / X previews.
 * Prefer CMS og_public_id; fall back to solid property photography; then mark.
 */
export function resolveShareImage(
  publicId?: string | null,
  alt = "Pelbu Suites, Olakha Thimphu",
): ShareImage {
  const candidates = [
    publicId?.trim() || null,
    BRAND_CLOUDINARY.hotelExterior,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsDeluxe,
    BRAND_CLOUDINARY.roomsSuiteAlt,
  ].filter((id): id is string => Boolean(id));

  for (const id of candidates) {
    // f_jpg + fixed dpr — social crawlers choke on auto format / AVIF more often.
    const url = cloudinaryUrl(id, {
      width: 1200,
      height: 630,
      crop: "fill",
      format: "jpg",
      quality: 85,
      dpr: 1,
    });
    if (url) {
      return { url, width: 1200, height: 630, alt };
    }
  }

  return {
    url: absoluteUrl("/icons/icon-512.png"),
    width: 512,
    height: 512,
    alt: SITE_NAME,
  };
}

/** Open Graph + Twitter fields ready to spread into generateMetadata / root metadata. */
export function shareSocialMeta(options?: {
  title?: string;
  description?: string;
  path?: string;
  publicId?: string | null;
  alt?: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = resolveShareImage(options?.publicId, options?.alt);
  const title = options?.title;
  const description = options?.description;
  const path = options?.path ?? "/";

  return {
    openGraph: {
      type: "website",
      locale: "en_BT",
      siteName: SITE_NAME,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      images: [image.url],
    },
  };
}
