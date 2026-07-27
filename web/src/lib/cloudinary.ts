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
};

/** Build a delivery URL for a Cloudinary public_id. Returns null if cloud unset. */
export function cloudinaryUrl(
  publicId: string,
  transform: CloudinaryTransform = {},
): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;

  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = transform;

  const parts: string[] = [`f_${format}`, `q_${quality}`];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`);

  const id = publicId.replace(/^\//, "").replace(/\.(png|jpe?g|webp|gif)$/i, "");
  return `https://res.cloudinary.com/${cloud}/image/upload/${parts.join(",")}/${id}`;
}
