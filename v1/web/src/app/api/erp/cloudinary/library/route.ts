import {
  listCloudinaryFolders,
  searchCloudinaryAssets,
} from "@/lib/cloudinary-admin";
import { cloudinaryConfigured } from "@/lib/cloudinary-upload";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function folderPrefixes(publicIds: string[]): string[] {
  const paths = new Set<string>();
  for (const publicId of publicIds) {
    const segments = publicId.split("/");
    for (let depth = 1; depth < segments.length; depth += 1) {
      paths.add(segments.slice(0, depth).join("/"));
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

/** Media gallery feed: images and videos, plus folder options on first load. */
export async function GET(request: NextRequest) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server." },
      { status: 503 },
    );
  }

  const params = request.nextUrl.searchParams;
  const cursor = params.get("cursor") ?? "";
  const typeParam = params.get("type") ?? "all";
  const resourceType =
    typeParam === "image" || typeParam === "video" ? typeParam : "all";

  try {
    const [page, folders] = await Promise.all([
      searchCloudinaryAssets({
        folder: params.get("folder") ?? "",
        query: params.get("q") ?? "",
        cursor,
        limit: 40,
        resourceType,
      }),
      cursor ? Promise.resolve<string[] | null>(null) : listCloudinaryFolders(),
    ]);

    return NextResponse.json({
      ...page,
      folders:
        folders && folders.length === 0
          ? folderPrefixes(page.assets.map((asset) => asset.publicId))
          : folders,
    });
  } catch (e) {
    console.error("cloudinary library failed", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Could not load Cloudinary media.",
      },
      { status: 502 },
    );
  }
}
