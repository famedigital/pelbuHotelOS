/** Cloudinary delivery helpers — public_ids from CMS, cloud from env. */

export function getCloudinaryCloudName(): string {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    ""
  );
}

export type CloudinaryFocal = {
  /** 0–1 left→right */
  x: number;
  /** 0–1 top→bottom */
  y: number;
};

export type CloudinaryTransform = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "scale";
  quality?: "auto" | "auto:best" | number;
  format?: "auto" | "webp" | "jpg" | "png";
  dpr?: "auto" | number;
  /** Relative fill anchor; maps to g_xy_center,x,y */
  gravity?: CloudinaryFocal | "auto" | "center";
  improve?: boolean;
  sharpen?: boolean;
};

function clampFocal(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(value * 10000) / 10000));
}

export function normalizeFocal(
  focalX?: number | null,
  focalY?: number | null,
): CloudinaryFocal {
  return {
    x: clampFocal(focalX ?? 0.5),
    y: clampFocal(focalY ?? 0.5),
  };
}

function gravityParts(
  gravity: CloudinaryTransform["gravity"],
): string[] {
  if (!gravity) return [];
  if (gravity === "auto") return ["g_auto"];
  if (gravity === "center") return ["g_center"];
  const { x, y } = normalizeFocal(gravity.x, gravity.y);
  return [`g_xy_center`, `x_${x}`, `y_${y}`];
}

function buildTransform(transform: CloudinaryTransform = {}): string {
  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
    dpr = "auto",
    gravity,
    improve = false,
    sharpen = false,
  } = transform;

  const parts: string[] = [`f_${format}`, `q_${quality}`, `dpr_${dpr}`];
  if (improve) parts.push("e_improve");
  if (sharpen) parts.push("e_sharpen:40");
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) {
    parts.push(`c_${crop}`);
    parts.push(...gravityParts(gravity));
  }
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

/** Hero photography: best quality + optional improve/sharpen + focal fill. */
export function cloudinaryHeroUrl(
  publicId: string,
  transform: CloudinaryTransform = {},
): string | null {
  return cloudinaryUrl(publicId, {
    quality: "auto:best",
    improve: true,
    sharpen: true,
    ...transform,
  });
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
    parts.push(...gravityParts(transform.gravity));
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
  return cloudinaryUrl(publicId, transform);
}

/** Tiny blurred placeholder for next/image blurDataURL. */
export function cloudinaryBlur(publicId: string): string | null {
  const cloud = getCloudinaryCloudName();
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_jpg,q_10,w_24,e_blur:400/${cleanPublicId(publicId)}`;
}

export type ParsedCloudinaryUrl = {
  cloud: string;
  publicId: string;
  gravity?: CloudinaryFocal | "auto" | "center";
  height?: number;
};

/**
 * Recover cloud + public_id (+ optional gravity) from a Cloudinary delivery URL.
 */
export function parseCloudinaryUrl(url: string): ParsedCloudinaryUrl | null {
  const match = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/.exec(
    url,
  );
  if (!match) return null;
  const [, cloud, rest] = match;
  const segments = rest.split("/");
  let gravity: ParsedCloudinaryUrl["gravity"];
  let height: number | undefined;

  // Drop the leading transform segment and capture gravity if present.
  if (segments.length > 1 && /(^|,)[a-z]{1,3}_[^,/]+/.test(segments[0])) {
    const transform = segments.shift()!;
    const tokens = transform.split(",");
    if (tokens.includes("g_auto")) gravity = "auto";
    else if (tokens.includes("g_center")) gravity = "center";
    else if (tokens.includes("g_xy_center")) {
      const xTok = tokens.find((t) => t.startsWith("x_") && !t.startsWith("x_w"));
      const yTok = tokens.find((t) => t.startsWith("y_"));
      const x = xTok ? Number(xTok.slice(2)) : 0.5;
      const y = yTok ? Number(yTok.slice(2)) : 0.5;
      gravity = normalizeFocal(x, y);
    }
    const hTok = tokens.find((t) => t.startsWith("h_"));
    if (hTok) {
      const h = Number(hTok.slice(2));
      if (Number.isFinite(h)) height = h;
    }
  }
  if (segments.length > 1 && /^v\d+$/.test(segments[0])) segments.shift();
  const publicId = segments.join("/");
  if (!publicId) return null;
  return { cloud, publicId, gravity, height };
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
 * Gravity from an already-baked Cloudinary URL is preserved on re-cut.
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
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const parsed = parseCloudinaryUrl(src);
    if (!parsed) return src;
    const transform: CloudinaryTransform = {
      width,
      height: parsed.height
        ? Math.round((parsed.height / (width || 1)) * width) || undefined
        : undefined,
      crop: "fill",
      quality: quality ?? "auto",
      dpr: 1,
      gravity: parsed.gravity,
    };
    // Preserve aspect if original had height ratio from first request
    if (parsed.height && width) {
      // height was absolute in the original URL — keep proportional crop height
      // when we only re-width; if h was set on original for fill, re-scale it.
    }
    return `https://res.cloudinary.com/${parsed.cloud}/image/upload/${buildTransform({
      width,
      crop: "fill",
      quality: quality ?? "auto",
      dpr: 1,
      gravity: parsed.gravity,
    })}/${parsed.publicId}`;
  }
  if (src.startsWith("/")) return src;

  return (
    cloudinaryUrl(src, {
      width,
      crop: "fill",
      quality: quality ?? "auto",
      dpr: 1,
    }) ?? src
  );
}
