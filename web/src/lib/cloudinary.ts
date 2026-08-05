/** Cloudinary delivery helpers — public_ids from CMS, cloud from env. */

export function getCloudinaryCloudName(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    ""
  );
}

export type CloudinaryTransform = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "scale";
  quality?: "auto" | number;
  format?: "auto" | "webp" | "jpg" | "png";
  dpr?: "auto" | number;
};

function buildTransform(transform: CloudinaryTransform = {}): string {
  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    dpr = "auto",
  } = transform;

  const parts: string[] = [`f_${format}`, `q_${quality}`, `dpr_${dpr}`];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`);
  return parts.join(",");
}

export type CloudinaryResourceType = "image" | "video";

function cleanPublicId(publicId: string): string {
  return publicId
    .replace(/^\//, "")
    .replace(/\.(png|jpe?g|webp|gif|mp4|mov|webm|m3u8)$/i, "");
}

/** Build a delivery URL for a Cloudinary public_id. Returns null if cloud unset. */
export function cloudinaryUrl(
  publicId: string,
  transform: CloudinaryTransform = {},
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/${buildTransform(transform)}/${cleanPublicId(publicId)}`;
}

/** Original file delivery, used when a PDF must remain a multi-page PDF. */
export function cloudinaryOriginalUrl(
  publicId: string,
  format?: string | null,
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  const clean = cleanPublicId(publicId).replace(/\.pdf$/i, "");
  const extension = format?.toLowerCase() === "pdf" ? ".pdf" : "";
  return `https://res.cloudinary.com/${cloud}/image/upload/${clean}${extension}`;
}

/**
 * Adaptive HLS delivery. Cloudinary picks bitrate/renditions on the fly with
 * `sp_auto`, so guests on slow mobile networks get a lighter stream.
 */
export function cloudinaryHlsUrl(publicId: string): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/video/upload/sp_auto/${cleanPublicId(publicId)}.m3u8`;
}

/** Progressive MP4 fallback when HLS is unavailable. */
export function cloudinaryVideoMp4Url(
  publicId: string,
  transform: Pick<CloudinaryTransform, "width" | "quality"> = {},
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  const parts = ["f_mp4", `q_${transform.quality ?? "auto"}`];
  if (transform.width) parts.push(`w_${transform.width}`, "c_limit");
  return `https://res.cloudinary.com/${cloud}/video/upload/${parts.join(",")}/${cleanPublicId(publicId)}.mp4`;
}

/** Still frame from a video — used as poster / card thumbnail. */
export function cloudinaryVideoPosterUrl(
  publicId: string,
  transform: CloudinaryTransform = {},
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  const parts = [
    "f_jpg",
    `q_${transform.quality ?? "auto"}`,
    "so_0",
  ];
  if (transform.width) parts.push(`w_${transform.width}`);
  if (transform.height) parts.push(`h_${transform.height}`);
  if (transform.width || transform.height) {
    parts.push(`c_${transform.crop ?? "fill"}`);
  }
  return `https://res.cloudinary.com/${cloud}/video/upload/${parts.join(",")}/${cleanPublicId(publicId)}.jpg`;
}

export function cloudinaryMediaThumbUrl(
  publicId: string,
  resourceType: CloudinaryResourceType,
  transform: CloudinaryTransform = {},
): string | null {
  if (resourceType === "video") {
    return cloudinaryVideoPosterUrl(publicId, transform);
  }
  return cloudinaryUrl(publicId, transform);
}

/**
 * Trust photography delivery: f_auto + q_auto (+ optional mild improve).
 * Prefer this for public room / gallery pages when you want a light refine.
 */
export function cloudinaryTrustUrl(
  publicId: string,
  transform: CloudinaryTransform & { improve?: boolean } = {},
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    dpr = "auto",
    improve = false,
  } = transform;
  const parts: string[] = [`f_${format}`, `q_${quality}`, `dpr_${dpr}`];
  if (improve) parts.push("e_improve");
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`);
  return `https://res.cloudinary.com/${cloud}/image/upload/${parts.join(",")}/${cleanPublicId(publicId)}`;
}

/** Tiny blurred placeholder for next/image blurDataURL. */
export function cloudinaryBlur(publicId: string): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_jpg,q_10,w_24,e_blur:400/${cleanPublicId(publicId)}`;
}


/**
 * Recover the cloud + public_id from a Cloudinary delivery URL so a baked-in
 * transform (for example `w_2400`) can be re-cut at the width next/image asks
 * for. Returns null for any non-Cloudinary URL.
 */
export function parseCloudinaryUrl(
  url: string,
): { cloud: string; publicId: string } | null {
  const match = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/.exec(
    url,
  );
  if (!match) return null;
  const [, cloud, rest] = match;
  const segments = rest.split("/");
  // Drop the leading transform segment (`f_auto,q_auto,...`) and any version.
  if (segments.length > 1 && /(^|,)[a-z]{1,3}_[^,/]+/.test(segments[0])) {
    segments.shift();
  }
  if (segments.length > 1 && /^v\d+$/.test(segments[0])) segments.shift();
  const publicId = segments.join("/");
  return publicId ? { cloud, publicId } : null;
}

/** True when next/image can route this source through the Cloudinary loader. */
export function isCloudinarySource(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/")) return false;
  if (value.startsWith("http")) return parseCloudinaryUrl(value) !== null;
  return true;
}

/**
 * Next.js custom image loader — keeps transforms on Cloudinary so Vercel
 * image optimization is never billed for photography. The loader must honour
 * `width`, otherwise next/image cannot build a srcset.
 */
export function cloudinaryImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // next/image already picks a density-appropriate width, so pin dpr to 1
  // instead of letting Cloudinary scale a second time.
  const transform = {
    width,
    crop: "fill" as const,
    quality: quality ?? ("auto" as const),
    dpr: 1,
  };

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const parsed = parseCloudinaryUrl(src);
    if (!parsed) return src;
    return `https://res.cloudinary.com/${parsed.cloud}/image/upload/${buildTransform(transform)}/${parsed.publicId}`;
  }
  if (src.startsWith("/")) return src;

  return cloudinaryUrl(src, transform) ?? src;
}
