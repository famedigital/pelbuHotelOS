import {
  absoluteUrl,
  PUBLIC_INDEXABLE_ROUTES,
} from "@/lib/site";
import { loadGuidePosts, loadPublicRooms } from "@/lib/public-content";
import type { MetadataRoute } from "next";

const PRIORITY: Partial<Record<(typeof PUBLIC_INDEXABLE_ROUTES)[number], number>> =
  {
    "/": 1,
    "/rooms": 0.95,
    "/rates": 0.95,
    "/menu": 0.9,
    "/contact": 0.85,
    "/gallery": 0.75,
    "/faq": 0.8,
    "/guide": 0.75,
    "/cafe": 0.8,
    "/restaurant": 0.8,
    "/bar": 0.75,
    "/spa": 0.75,
    "/meeting": 0.7,
    "/services": 0.7,
    "/salon": 0.65,
    "/stay/olakha-thimphu": 0.85,
    "/stay/hotels-in-thimphu": 0.9,
    "/stay/food-in-thimphu": 0.85,
    "/stay/facilities-service": 0.8,
    "/agents": 0.6,
    "/careers": 0.65,
  };

/**
 * XML sitemap at /sitemap.xml for Google Search Console.
 * Only indexable public URLs — ERP/staff/pay stay out via robots + omission here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [rooms, guides] = await Promise.all([
    loadPublicRooms(),
    loadGuidePosts(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_INDEXABLE_ROUTES.map(
    (path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency:
        path === "/" || path === "/rooms" || path === "/rates" || path === "/menu"
          ? ("daily" as const)
          : path === "/guide" || path === "/faq"
            ? ("weekly" as const)
            : ("weekly" as const),
      priority: PRIORITY[path] ?? 0.7,
    }),
  );

  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: absoluteUrl(`/rooms/${room.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
    images: room.imageSrc ? [room.imageSrc] : undefined,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((post) => ({
    url: absoluteUrl(`/guide/${post.slug}`),
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
    images: post.coverSrc ? [post.coverSrc] : undefined,
  }));

  return [...staticRoutes, ...roomRoutes, ...guideRoutes];
}
