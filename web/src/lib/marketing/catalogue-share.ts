/** Share URLs + caption builders for catalogue IG/FB packs. */

import { absoluteUrl } from "@/lib/site";

export type CatalogueShareSource =
  | "instagram"
  | "facebook"
  | "agent"
  | "qr"
  | "copy";

export function cataloguePublicPath(slug: string): string {
  return `/c/${slug}`;
}

export function catalogueShareUrl(
  slug: string,
  source: CatalogueShareSource = "copy",
): string {
  const path = cataloguePublicPath(slug);
  const base = absoluteUrl(path);
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: source === "agent" ? "partner" : "social",
    utm_campaign: slug,
  });
  return `${base}?${params.toString()}`;
}

export function buildCatalogueCaption(opts: {
  feedCaption: string | null;
  storyCaption?: string | null;
  agentCaption?: string | null;
  hashtags: string | null;
  promoCode: string | null;
  audience: "public" | "agents" | "media_press";
  mode?: "feed" | "story" | "agent";
}): string {
  const mode =
    opts.mode ??
    (opts.audience === "agents" ? "agent" : "feed");
  let body =
    mode === "story"
      ? opts.storyCaption?.trim() || opts.feedCaption?.trim() || ""
      : mode === "agent"
        ? opts.agentCaption?.trim() || opts.feedCaption?.trim() || ""
        : opts.feedCaption?.trim() || "";

  if (opts.promoCode) {
    const mention = `Code ${opts.promoCode}`;
    if (!body.toLowerCase().includes(opts.promoCode.toLowerCase())) {
      body = body ? `${body}\n\n${mention}` : mention;
    }
  }

  const tags = opts.hashtags?.trim() ?? "";
  return [body, tags].filter(Boolean).join("\n\n");
}
