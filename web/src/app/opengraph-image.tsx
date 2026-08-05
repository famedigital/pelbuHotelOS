import { resolveShareImage } from "@/lib/og-share";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";
export const alt = "Pelbu Suites, Olakha Thimphu";

/**
 * Canonical share image at /opengraph-image — WhatsApp/Facebook fetch this
 * first. Redirects to a stable JPEG on Cloudinary (or the brand mark).
 */
export default function OpenGraphImage() {
  const image = resolveShareImage();
  return Response.redirect(image.url, 307);
}
