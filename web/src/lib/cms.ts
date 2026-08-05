import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  cloudinaryHeroUrl,
  cloudinaryMediaThumbUrl,
  normalizeFocal,
} from "@/lib/cloudinary";
import {
  DEFAULT_HERO_THEME,
  parseHeroTheme,
  type HeroTheme,
} from "@/lib/hero-theme";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

/** Same remap as menu-loader — keep gallery thumbs off broken seed IDs. */
const CMS_MEDIA_REMAP: Record<string, string> = {
  "pelbu/menu/restaurant-butter-chicken-naan":
    "pelbu/menu/cafe-grilled-chicken-plate",
  "pelbu/menu/restaurant-river-trout": "pelbu/restaurant/signature-plate",
  "pelbu/menu/restaurant-red-rice-ema-datshi":
    "pelbu/menu/cafe-ema-datshi-rice-bowl",
  "pelbu/menu/pastry-butter-croissant": "pelbu/cafe/morning-pastry",
  "pelbu/menu/pastry-cardamom-bun": "pelbu/menu/cafe-suja-khabzay",
};

function resolveCmsPublicId(publicId: string): string {
  return CMS_MEDIA_REMAP[publicId] ?? publicId;
}

export type CmsContentSection = {
  heading: string;
  paragraphs: string[];
  items: string[];
};

export type CmsPage = {
  slug: string;
  eyebrow: string;
  title: string;
  body: string;
  hours_note: string | null;
  primary_cta_href: string | null;
  primary_cta_label: string | null;
  secondary_cta_href: string | null;
  secondary_cta_label: string | null;
  meta_description: string | null;
  seo_title: string | null;
  canonical_path: string | null;
  /** Cloudinary public_id for link-share / Open Graph image. */
  og_public_id: string | null;
  summary: string | null;
  faq_json: Array<{ question: string; answer: string }>;
  sections_json: CmsContentSection[];
  /** Homepage hero palette (ignored on other slugs). */
  hero_theme: HeroTheme;
};

export type CmsMediaItem = {
  id: string;
  public_id: string;
  alt: string;
  kind: string;
  sort_order: number;
  resource_type: "image" | "video";
  poster_public_id: string | null;
  focal_x: number;
  focal_y: number;
  /** Resolved Cloudinary image URL / video poster, or null if cloud env missing */
  src: string | null;
};

function contentSections(value: unknown): CmsContentSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const heading =
      typeof record.heading === "string" ? record.heading.trim() : "";
    if (!heading) return [];
    const paragraphs = Array.isArray(record.paragraphs)
      ? record.paragraphs.filter(
          (paragraph): paragraph is string =>
            typeof paragraph === "string" && Boolean(paragraph.trim()),
        )
      : [];
    const items = Array.isArray(record.items)
      ? record.items.filter(
          (listItem): listItem is string =>
            typeof listItem === "string" && Boolean(listItem.trim()),
        )
      : [];
    return [{ heading, paragraphs, items }];
  });
}

export async function loadCmsPage(slug: string): Promise<CmsPage | null> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return null;
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("cms_pages")
    .select(
      "slug, eyebrow, title, body, hours_note, primary_cta_href, primary_cta_label, secondary_cta_href, secondary_cta_label, meta_description, seo_title, canonical_path, og_public_id, summary, faq_json, sections_json, hero_theme",
    )
    .eq("property_id", propertyId)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) return null;
  return {
    slug: data.slug as string,
    eyebrow: data.eyebrow as string,
    title: data.title as string,
    body: data.body as string,
    hours_note: (data.hours_note as string | null) ?? null,
    primary_cta_href: (data.primary_cta_href as string | null) ?? null,
    primary_cta_label: (data.primary_cta_label as string | null) ?? null,
    secondary_cta_href: (data.secondary_cta_href as string | null) ?? null,
    secondary_cta_label: (data.secondary_cta_label as string | null) ?? null,
    meta_description: (data.meta_description as string | null) ?? null,
    seo_title: (data.seo_title as string | null) ?? null,
    canonical_path: (data.canonical_path as string | null) ?? null,
    og_public_id: (data.og_public_id as string | null) ?? null,
    summary: (data.summary as string | null) ?? null,
    faq_json: Array.isArray(data.faq_json)
      ? (data.faq_json as Array<{ question: string; answer: string }>)
      : [],
    sections_json: contentSections(data.sections_json),
    hero_theme: parseHeroTheme(data.hero_theme ?? DEFAULT_HERO_THEME),
  };
}

/** Prefer `kind=hero`, else first item with a resolved URL. */
export function pickHeroSrc(items: CmsMediaItem[]): string | null {
  return (
    items.find((m) => m.kind === "hero" && m.src)?.src ??
    items.find((m) => m.src)?.src ??
    null
  );
}

export async function loadCmsGallery(
  pageSlug: string,
  width = 960,
  options?: { height?: number; heroQuality?: boolean },
): Promise<CmsMediaItem[]> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("cms_media")
    .select(
      "id, public_id, alt, kind, sort_order, resource_type, poster_public_id, focal_x, focal_y",
    )
    .eq("property_id", propertyId)
    .eq("page_slug", pageSlug)
    .eq("is_published", true)
    .order("sort_order");

  return (data ?? []).map((row) => {
    const publicId = resolveCmsPublicId(row.public_id as string);
    const resourceType =
      row.resource_type === "video" ? ("video" as const) : ("image" as const);
    const poster = (row.poster_public_id as string | null) ?? null;
    const focal = normalizeFocal(
      row.focal_x == null ? 0.5 : Number(row.focal_x),
      row.focal_y == null ? 0.5 : Number(row.focal_y),
    );
    const kind = row.kind as string;
    const isHero = kind === "hero" || kind === "hero_mobile";
    const transform = {
      width: isHero && options?.heroQuality
        ? Math.max(width, 2880)
        : width,
      height: options?.height,
      crop: "fill" as const,
      gravity: focal,
      ...(isHero && options?.heroQuality
        ? {
            quality: "auto:best" as const,
            sharpen: true,
            improve: false,
          }
        : {}),
    };
    const assetId = poster || publicId;
    const src =
      isHero && options?.heroQuality && resourceType === "image" && !poster
        ? cloudinaryHeroUrl(publicId, transform)
        : cloudinaryMediaThumbUrl(
            assetId,
            poster ? "image" : resourceType,
            transform,
          );
    return {
      id: row.id as string,
      public_id: publicId,
      alt: (row.alt as string) || "",
      kind,
      sort_order: Number(row.sort_order),
      resource_type: resourceType,
      poster_public_id: poster,
      focal_x: focal.x,
      focal_y: focal.y,
      src,
    };
  });
}
