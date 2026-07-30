import "server-only";
import { getCloudinaryConfig } from "@/lib/cloudinary-upload";

/**
 * Read-only Cloudinary Admin API access for the in-app media gallery.
 *
 * Assets in this account keep the folder inside `public_id` and leave
 * `asset_folder` empty on some uploads, so folder filtering uses a
 * `public_id` prefix — that matches every asset regardless of upload mode.
 */
export type CloudinaryAsset = {
  publicId: string;
  resourceType: "image" | "video";
  format: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number | null;
  uploadedAt: string;
};

export type CloudinaryLibraryPage = {
  assets: CloudinaryAsset[];
  nextCursor: string | null;
  total: number;
};

const SAFE_FOLDER = /^[A-Za-z0-9_\-/]+$/;

function authHeader(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/** Folder paths must be plain slug segments — we build them into expressions. */
export function isSafeCloudinaryFolder(folder: string): boolean {
  return SAFE_FOLDER.test(folder) && !folder.includes("//");
}

function sanitizeQuery(query: string): string {
  return query.replace(/[^A-Za-z0-9 _\-./]/g, " ").trim().slice(0, 80);
}

function buildExpression(
  folder: string,
  query: string,
  resourceType: "image" | "video" | "all",
): string {
  const clauses: string[] = [];
  if (resourceType === "all") {
    clauses.push("(resource_type:image OR resource_type:video)");
  } else {
    clauses.push(`resource_type:${resourceType}`);
  }
  if (folder && isSafeCloudinaryFolder(folder)) {
    clauses.push(`public_id:${folder}/*`);
  }
  const term = sanitizeQuery(query).split(/\s+/).filter(Boolean)[0];
  if (term) {
    clauses.push(
      `(filename:${term}* OR display_name:${term}* OR tags:${term}* OR public_id:${term}*)`,
    );
  }
  return clauses.join(" AND ");
}

export async function searchCloudinaryAssets({
  folder = "",
  query = "",
  cursor = "",
  limit = 40,
  resourceType = "all",
}: {
  folder?: string;
  query?: string;
  cursor?: string;
  limit?: number;
  resourceType?: "image" | "video" | "all";
}): Promise<CloudinaryLibraryPage> {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured on the server.");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/search`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        authorization: authHeader(config.apiKey, config.apiSecret),
      },
      body: JSON.stringify({
        expression: buildExpression(folder, query, resourceType),
        max_results: Math.min(Math.max(limit, 1), 100),
        sort_by: [{ uploaded_at: "desc" }],
        ...(cursor ? { next_cursor: cursor } : {}),
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Cloudinary search failed (${response.status}). ${detail.slice(0, 200)}`,
    );
  }

  const json = (await response.json()) as {
    resources?: Array<{
      public_id?: string;
      resource_type?: string;
      format?: string;
      bytes?: number;
      width?: number;
      height?: number;
      duration?: number;
      uploaded_at?: string;
      created_at?: string;
    }>;
    next_cursor?: string;
    total_count?: number;
  };

  return {
    assets: (json.resources ?? [])
      .filter((item): item is { public_id: string } & typeof item =>
        Boolean(item.public_id),
      )
      .map((item) => ({
        publicId: item.public_id,
        resourceType: item.resource_type === "video" ? "video" : "image",
        format: item.format ?? "",
        bytes: Number(item.bytes ?? 0),
        width: Number(item.width ?? 0),
        height: Number(item.height ?? 0),
        durationSec:
          item.duration == null ? null : Number(item.duration),
        uploadedAt: item.uploaded_at ?? item.created_at ?? "",
      })),
    nextCursor: json.next_cursor ?? null,
    total: Number(json.total_count ?? 0),
  };
}

/** @deprecated Prefer searchCloudinaryAssets — kept for existing image callers. */
export async function searchCloudinaryImages(
  args: {
    folder?: string;
    query?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<CloudinaryLibraryPage> {
  return searchCloudinaryAssets({ ...args, resourceType: "image" });
}

async function fetchFolders(path: string): Promise<string[]> {
  const config = getCloudinaryConfig();
  if (!config) return [];

  const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/folders${
    path ? `/${path}` : ""
  }`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { authorization: authHeader(config.apiKey, config.apiSecret) },
  });
  if (!response.ok) return [];

  const json = (await response.json()) as {
    folders?: Array<{ path?: string }>;
  };
  return (json.folders ?? [])
    .map((folder) => folder.path ?? "")
    .filter((folderPath) => folderPath && isSafeCloudinaryFolder(folderPath));
}

/** Root folders plus one level of children — deep enough for `pelbu/*`. */
export async function listCloudinaryFolders(): Promise<string[]> {
  const roots = await fetchFolders("");
  const nested = await Promise.all(roots.map((root) => fetchFolders(root)));
  return [...new Set([...roots, ...nested.flat()])].sort((a, b) =>
    a.localeCompare(b),
  );
}
