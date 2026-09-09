import { publicForceDynamic } from "@/lib/free-tier";

/**
 * Marketing page cache mode. Kill-switch: PUBLIC_FORCE_DYNAMIC=1.
 * Menu stays force-dynamic separately (live stock).
 */
export function publicMarketingCache(): {
  dynamic: "force-dynamic" | "auto";
  revalidate: number | false;
} {
  if (publicForceDynamic()) {
    return { dynamic: "force-dynamic", revalidate: false };
  }
  return { dynamic: "auto", revalidate: 60 };
}
