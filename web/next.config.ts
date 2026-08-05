import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
