import { absoluteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/**
 * robots.txt + sitemap pointer for Google Search Console.
 * Submit: https://pelbusuites.bt/sitemap.xml
 */
export default function robots(): MetadataRoute.Robots {
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
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
