/**
 * Direct browser → Cloudinary upload with chunking for large phone videos.
 * Files never pass through Next.js server actions (1 MB body limit).
 */

export type CloudinaryResourceType = "image" | "video";

export type CloudinaryUploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
};

export type CloudinaryUploadResult = {
  publicId: string;
  resourceType: CloudinaryResourceType;
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number | null;
  secureUrl: string | null;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/svg+xml",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
]);

/** 5 MB minimum for all but the final Cloudinary chunk. */
const CHUNK_SIZE = 8 * 1024 * 1024;
/** Phone photos stay under this; larger files go through video endpoint or fail. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** High-res phone video ceiling for desk uploads. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export function detectResourceType(file: File): CloudinaryResourceType {
  if (VIDEO_TYPES.has(file.type) || file.type.startsWith("video/")) {
    return "video";
  }
  if (IMAGE_TYPES.has(file.type) || file.type.startsWith("image/")) {
    return "image";
  }
  // iOS sometimes omits MIME; fall back to extension.
  const name = file.name.toLowerCase();
  if (/\.(mp4|mov|m4v|webm|3gp)$/.test(name)) return "video";
  if (/\.(jpe?g|png|webp|heic|heif|gif|svg)$/.test(name)) return "image";
  throw new Error("Choose a photo or video file.");
}

export function assertUploadable(file: File): CloudinaryResourceType {
  const resourceType = detectResourceType(file);
  if (resourceType === "image" && file.size > MAX_IMAGE_BYTES) {
    throw new Error("Photos must be 25 MB or smaller.");
  }
  if (resourceType === "video" && file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be 500 MB or smaller.");
  }
  return resourceType;
}

async function fetchTicket(
  folder: string,
  signEndpoint: string,
  context?: Record<string, string>,
): Promise<CloudinaryUploadTicket> {
  const response = await fetch(signEndpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder, ...context }),
  });
  const ticket = (await response.json()) as CloudinaryUploadTicket & {
    error?: string;
  };
  if (!response.ok || !ticket.cloudName || !ticket.signature) {
    throw new Error(ticket.error ?? "Could not start the upload.");
  }
  return ticket;
}

function appendSignedFields(
  form: FormData,
  ticket: CloudinaryUploadTicket,
  file: Blob,
) {
  form.append("file", file);
  form.append("api_key", ticket.apiKey);
  form.append("timestamp", ticket.timestamp);
  form.append("folder", ticket.folder);
  form.append("signature", ticket.signature);
}

function parseUploadJson(json: Record<string, unknown>): CloudinaryUploadResult {
  const publicId = String(json.public_id ?? "");
  if (!publicId) {
    const message =
      typeof json.error === "object" &&
      json.error &&
      "message" in json.error
        ? String((json.error as { message?: string }).message)
        : "Cloudinary rejected the upload.";
    throw new Error(message);
  }
  const resourceType =
    json.resource_type === "video" ? "video" : ("image" as const);
  return {
    publicId,
    resourceType,
    format: String(json.format ?? ""),
    bytes: Number(json.bytes ?? 0),
    width: Number(json.width ?? 0),
    height: Number(json.height ?? 0),
    durationSec:
      json.duration == null || json.duration === ""
        ? null
        : Number(json.duration),
    secureUrl:
      typeof json.secure_url === "string" ? json.secure_url : null,
  };
}

async function uploadSimple(
  file: File,
  ticket: CloudinaryUploadTicket,
  resourceType: CloudinaryResourceType,
  onProgress?: (progress: UploadProgress) => void,
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  appendSignedFields(form, ticket, file);

  const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${ticket.cloudName}/${resourceType}/upload`,
    );
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as Record<string, unknown>;
        if (xhr.status >= 400) {
          reject(
            new Error(
              typeof json.error === "object" &&
                json.error &&
                "message" in json.error
                ? String((json.error as { message?: string }).message)
                : `Upload failed (${xhr.status}).`,
            ),
          );
          return;
        }
        resolve(parseUploadJson(json));
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Upload response invalid."),
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });

  return result;
}

async function uploadChunked(
  file: File,
  ticket: CloudinaryUploadTicket,
  resourceType: CloudinaryResourceType,
  onProgress?: (progress: UploadProgress) => void,
): Promise<CloudinaryUploadResult> {
  const uploadId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const total = file.size;
  let offset = 0;
  let final: CloudinaryUploadResult | null = null;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const blob = file.slice(offset, end);
    const form = new FormData();
    appendSignedFields(form, ticket, blob);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${ticket.cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        headers: {
          "X-Unique-Upload-Id": uploadId,
          "Content-Range": `bytes ${offset}-${end - 1}/${total}`,
        },
        body: form,
      },
    );
    const json = (await response.json()) as Record<string, unknown> & {
      done?: boolean;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message ?? `Upload failed (${response.status}).`);
    }

    offset = end;
    onProgress?.({
      loaded: offset,
      total,
      percent: Math.round((offset / total) * 100),
    });

    if (json.done !== false && json.public_id) {
      final = parseUploadJson(json);
    }
  }

  if (!final) throw new Error("Cloudinary did not finish the chunked upload.");
  return final;
}

/**
 * Upload a photo or video straight from the phone/desk browser to Cloudinary.
 * Large files use Content-Range chunking so a dropped mobile connection can
 * resume from the last successful chunk on retry of the whole file.
 */
export async function uploadToCloudinary(
  file: File,
  options: {
    folder: string;
    onProgress?: (progress: UploadProgress) => void;
    signEndpoint?: string;
    signContext?: Record<string, string>;
    imageOnly?: boolean;
  },
): Promise<CloudinaryUploadResult> {
  const resourceType = assertUploadable(file);
  if (options.imageOnly && resourceType !== "image") {
    throw new Error("Choose a photo file.");
  }
  const ticket = await fetchTicket(
    options.folder,
    options.signEndpoint ?? "/api/erp/cloudinary/sign-upload",
    options.signContext,
  );
  if (file.size > CHUNK_SIZE) {
    return uploadChunked(file, ticket, resourceType, options.onProgress);
  }
  return uploadSimple(file, ticket, resourceType, options.onProgress);
}
