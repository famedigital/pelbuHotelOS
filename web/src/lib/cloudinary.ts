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

/**
 * Cloudinary g_xy_center expects x/y as percentage offsets 0–100 integers
 * (or absolute px). Fractional 0–1 values (e.g. x_0.5) return HTTP 400 and
 * blank every image that uses a focal point — including homepage story.
 */
function gravityParts(
  gravity: CloudinaryTransform["gravity"],
): string[] {
  if (!gravity) return [];
  if (gravity === "auto") return ["g_auto"];
  if (gravity === "center") return ["g_center"];
  const { x, y } = normalizeFocal(gravity.x, gravity.y);
  // Store focal as 0–1 in CMS; emit percent for the CDN URL.
  const px = Math.round(x * 100);
  const py = Math.round(y * 100);
  return ["g_xy_center", `x_${px}`, `y_${py}`];
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
    // Defaults first; call-site can still force improve if needed.
    improve: false,
    sharpen: true,
    quality: "auto:best",
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
  /** Intrinsic crop box from the original delivery URL (CSS pixels). */
  width?: number;
  height?: number;
  improve?: boolean;
  sharpen?: boolean;
};

/**
 * Recover cloud + public_id (+ gravity + crop box) from a Cloudinary delivery URL.
 */
export function parseCloudinaryUrl(url: string): ParsedCloudinaryUrl | null {
  const match = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/.exec(
    url,
  );
  if (!match) return null;
  const [, cloud, rest] = match;
  const segments = rest.split("/");
  let gravity: ParsedCloudinaryUrl["gravity"];
  let width: number | undefined;
  let height: number | undefined;
  let improve = false;
  let sharpen = false;

  // Drop the leading transform segment and capture crop/gravity tokens.
  if (segments.length > 1 && /(^|,)[a-z]{1,3}_[^,/]+/.test(segments[0])) {
    const transform = segments.shift()!;
    const tokens = transform.split(",");
    if (tokens.includes("g_auto") || tokens.some((t) => t.startsWith("g_auto:"))) {
      gravity = "auto";
    } else if (tokens.includes("g_center")) {
      gravity = "center";
    } else if (tokens.includes("g_xy_center")) {
      const xTok = tokens.find((t) => t.startsWith("x_") && !t.startsWith("x_w"));
      const yTok = tokens.find((t) => t.startsWith("y_"));
      // URLs use 0–100 percent; store back as 0–1 for normalizeFocal.
      const xRaw = xTok ? Number(xTok.slice(2)) : 50;
      const yRaw = yTok ? Number(yTok.slice(2)) : 50;
      const x = xRaw > 1 ? xRaw / 100 : xRaw;
      const y = yRaw > 1 ? yRaw / 100 : yRaw;
      gravity = normalizeFocal(x, y);
    }
    const wTok = tokens.find((t) => t.startsWith("w_"));
    const hTok = tokens.find((t) => t.startsWith("h_"));
    if (wTok) {
      const w = Number(wTok.slice(2));
      if (Number.isFinite(w) && w > 0) width = w;
    }
    if (hTok) {
      const h = Number(hTok.slice(2));
      if (Number.isFinite(h) && h > 0) height = h;
    }
    if (tokens.some((t) => t === "e_improve" || t.startsWith("e_improve:"))) {
      improve = true;
    }
    if (tokens.some((t) => t.startsWith("e_sharpen"))) {
      sharpen = true;
    }
  }
  if (segments.length > 1 && /^v\d+$/.test(segments[0])) segments.shift();
  const publicId = segments.join("/");
  if (!publicId) return null;
  return { cloud, publicId, gravity, width, height, improve, sharpen };
}

/** True when next/image can route this source through the Cloudinary loader. */
export function isCloudinarySource(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/")) return false;
  if (value.startsWith("http")) return parseCloudinaryUrl(value) !== null;
  return true;
}

/**
 * Next.js default `quality={75}` made retina sources mushy (`q_75`).
 * Map to Cloudinary auto tiers; heroes / large photos use `auto:best`.
 */
function resolveLoaderQuality(
  quality: number | undefined,
  pixelWidth: number,
): CloudinaryTransform["quality"] {
  if (quality == null) {
    return pixelWidth >= 1200 ? "auto:best" : "auto:good";
  }
  if (quality >= 85) return "auto:best";
  if (quality >= 70) return pixelWidth >= 1600 ? "auto:best" : "auto:good";
  return quality;
}

/**
 * Scale fill height so Next width steps keep the original crop ratio.
 * Without h_, fill crops are soft / wrong and retina screens look "blurred".
 */
function proportionalHeight(
  sourceW: number | undefined,
  sourceH: number | undefined,
  requestW: number,
): number | undefined {
  if (!requestW || requestW <= 0) return undefined;
  if (sourceW && sourceH && sourceW > 0) {
    return Math.max(1, Math.round((sourceH / sourceW) * requestW));
  }
  if (sourceH && !sourceW) {
    // Legacy URLs only stored h — assume 16:9 landscape.
    return Math.max(1, Math.round(requestW * (9 / 16)));
  }
  return undefined;
}

/**
 * Next.js custom image loader — keeps transforms on Cloudinary so Vercel
 * image optimization is never billed for photography.
 *
 * Retina path: next/image requests width ≈ CSS width × DPR (up to 3840).
 * We emit that exact pixel size with q_auto:best + mild sharpen, dpr=1
 * (pixels already doubled — never stack dpr_auto).
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
  // Cap at 4K long edge — full-bleed heroes on 3× phones still look crisp.
  const w = Math.min(Math.max(1, Math.round(width)), 3840);
  const q = resolveLoaderQuality(quality, w);

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const parsed = parseCloudinaryUrl(src);
    if (!parsed) return src;
    const h = proportionalHeight(parsed.width, parsed.height, w);
    // Prefer original framing quality; always sharpen large deliveries.
    const useImprove = Boolean(parsed.improve);
    const useSharpen = w >= 1000 || Boolean(parsed.sharpen);

    return (
      `https://res.cloudinary.com/${parsed.cloud}/image/upload/` +
      `${buildTransform({
        width: w,
        height: h,
        crop: h ? "fill" : "limit",
        quality: q,
        dpr: 1,
        gravity: parsed.gravity ?? (h ? "auto" : undefined),
        improve: useImprove,
        sharpen: useSharpen,
      })}/${parsed.publicId}`
    );
  }
  if (src.startsWith("/")) return src;

  return (
    cloudinaryUrl(src, {
      width: w,
      crop: "limit",
      quality: q,
      dpr: 1,
      sharpen: w >= 1000,
    }) ?? src
  );
}

