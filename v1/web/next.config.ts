import path from "node:path";
import type { NextConfig } from "next";

/**
 * Repo root: lets Turbopack compile `@hotel-os/core` from `../packages/core`
 * (shared money core with Hotel OS v2). Docker copies that folder beside web/.
 */
const workspaceRoot = path.join(__dirname, "..");

/**
 * Next.js loads `next.config` in an isolated compile step — do not import app or
 * `@hotel-os/core` here (MODULE_NOT_FOUND). Keep slug logic duplicated from
 * `packages/core/src/property/normalize-property-slug.ts` + resolve-default-v2-property-slug.
 */
const FALLBACK_V2_PROPERTY_SLUG = "pelbu-olakha";

const PROPERTY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidConfig(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizePropertySlugForNextConfig(
  raw: string | undefined | null,
): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (isUuidConfig(s)) return s;
  if (PROPERTY_SLUG_RE.test(s)) return s.toLowerCase();
  const segments = s
    .split(/\s*[·|•]\s*/u)
    .map((p) => p.trim())
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (isUuidConfig(seg)) return seg;
    if (PROPERTY_SLUG_RE.test(seg)) return seg.toLowerCase();
  }
  const tokens = s.match(/[a-z0-9]+(?:-[a-z0-9]+)*/gi);
  if (tokens?.length) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const t = tokens[i];
      if (PROPERTY_SLUG_RE.test(t)) return t.toLowerCase();
    }
  }
  return null;
}

function resolveDefaultV2PropertySlugForNextConfig(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_SLUG,
    process.env.DEFAULT_PROPERTY_SLUG,
    process.env.FLAGSHIP_PROPERTY_SLUG,
    process.env.NEXT_PUBLIC_FLAGSHIP_PROPERTY_SLUG,
  ];
  for (const c of candidates) {
    const n = normalizePropertySlugForNextConfig(c);
    if (n) return n;
  }
  return FALLBACK_V2_PROPERTY_SLUG;
}

/** v2 PIN: tenant slug for `/v1/auth/staff` — must exist in `properties.slug` (e.g. Pelbu). */
const defaultV2PropertySlug = resolveDefaultV2PropertySlugForNextConfig();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEFAULT_PROPERTY_SLUG: defaultV2PropertySlug,
  },
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
  // Droplet builds share ~8Gi with Supabase; multi-worker tsc OOMs/swaps.
  // Typecheck locally / in CI; keep docker `next build` single-worker.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "recharts",
      "@tanstack/react-table",
      "framer-motion",
    ],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
    /**
     * Dense device widths for true retina (2× / 3×). Next feeds these into
     * our Cloudinary loader as `width` so srcset can pick ~CSS×DPR pixels.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 2560, 2880, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 640, 750],
    qualities: [75, 85, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/dine", destination: "/menu", permanent: true },
      { source: "/order", destination: "/menu", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/iclock/:name.aspx", destination: "/iclock/:name" },
    ];
  },
};

export default nextConfig;
