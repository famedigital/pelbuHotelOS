import "server-only";
import { createHash } from "node:crypto";

/**
 * Cloudinary credentials + request signing.
 *
 * Files are never proxied through server actions (Next caps those bodies at
 * 1 MB) — the browser posts directly to Cloudinary with a signature minted
 * here, and only the resulting public_id comes back to us.
 */
export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ||
    "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function cloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

/** Signature = sha1 of sorted "k=v" params joined by "&" + api_secret. */
export function signCloudinaryParams(
  params: Record<string, string>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

export type CloudinaryUploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
};

/** Everything the browser needs for one signed upload into `folder`. */
export function createUploadTicket(folder: string): CloudinaryUploadTicket {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary is not configured on the server.");
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signCloudinaryParams(
    { folder, timestamp },
    config.apiSecret,
  );
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    signature,
    folder,
  };
}
