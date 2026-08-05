import { getSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/**
 * robots.txt + sitemap pointer for Google Search Console.
 * Submit: https://pelbusuites.bt/sitemap.xml
 * Hosts always resolve to the brand domain (never *.vercel.app).
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/erp/",
          "/staff/",
          "/agents/app/",
          "/agents/portal",
          "/agents/login",
          "/login",
          "/pay/",
          "/guest/",
          "/laundry",
          "/c/",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
