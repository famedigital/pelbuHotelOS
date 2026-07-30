import {
  absoluteUrl,
  PUBLIC_INDEXABLE_ROUTES,
} from "@/lib/site";
import { loadGuidePosts, loadPublicRooms } from "@/lib/public-content";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rooms, guides] = await Promise.all([
    loadPublicRooms(),
    loadGuidePosts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_INDEXABLE_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency:
      path === "/" || path === "/rooms" || path === "/book"
        ? "daily"
        : "weekly",
    priority: path === "/" ? 1 : path === "/book" ? 0.95 : 0.8,
  }));

  return [
    ...staticRoutes,
    ...rooms.map((room) => ({
      url: absoluteUrl(`/rooms/${room.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...guides.map((post) => ({
      url: absoluteUrl(`/guide/${post.slug}`),
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
