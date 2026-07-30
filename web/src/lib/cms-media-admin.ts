import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudinaryResourceType } from "@/lib/cloudinary";

export const CMS_MEDIA_KINDS = ["hero", "gallery", "thumb"] as const;
export type CmsMediaKind = (typeof CMS_MEDIA_KINDS)[number];

export type CmsMediaRow = {
  id: string;
  page_slug: string;
  public_id: string;
  alt: string;
  kind: CmsMediaKind;
  sort_order: number;
  is_published: boolean;
  resource_type: CloudinaryResourceType;
  poster_public_id: string | null;
  duration_sec: number | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
};

export type CmsMediaGroup = {
  page_slug: string;
  items: CmsMediaRow[];
};

function toKind(value: unknown): CmsMediaKind {
  return CMS_MEDIA_KINDS.includes(value as CmsMediaKind)
    ? (value as CmsMediaKind)
    : "gallery";
}

function toResourceType(value: unknown): CloudinaryResourceType {
  return value === "video" ? "video" : "image";
}

/**
 * Every media row for the property, grouped by the public page it belongs to.
 * Page slugs come from `cms_pages` as well as `cms_media`, so a page with no
 * photography yet still gets an empty group the desk can fill.
 */
export async function loadCmsMediaGroups(
  admin: SupabaseClient,
  propertyId: string,
): Promise<CmsMediaGroup[]> {
  const [mediaResult, pagesResult] = await Promise.all([
    admin
      .from("cms_media")
      .select(
        "id, page_slug, public_id, alt, kind, sort_order, is_published, resource_type, poster_public_id, duration_sec, bytes, width, height, format",
      )
      .eq("property_id", propertyId)
      .order("page_slug")
      .order("sort_order"),
    admin
      .from("cms_pages")
      .select("slug")
      .eq("property_id", propertyId)
      .order("slug"),
  ]);

  if (mediaResult.error) throw new Error(mediaResult.error.message);
  if (pagesResult.error) throw new Error(pagesResult.error.message);

  const groups = new Map<string, CmsMediaRow[]>();
  for (const page of pagesResult.data ?? []) {
    groups.set(page.slug as string, []);
  }

  for (const row of mediaResult.data ?? []) {
    const slug = row.page_slug as string;
    const list = groups.get(slug) ?? [];
    list.push({
      id: row.id as string,
      page_slug: slug,
      public_id: row.public_id as string,
      alt: (row.alt as string) ?? "",
      kind: toKind(row.kind),
      sort_order: Number(row.sort_order ?? 0),
      is_published: Boolean(row.is_published),
      resource_type: toResourceType(row.resource_type),
      poster_public_id: (row.poster_public_id as string | null) ?? null,
      duration_sec:
        row.duration_sec == null ? null : Number(row.duration_sec),
      bytes: row.bytes == null ? null : Number(row.bytes),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      format: (row.format as string | null) ?? null,
    });
    groups.set(slug, list);
  }

  return [...groups.entries()]
    .map(([page_slug, items]) => ({ page_slug, items }))
    .sort((a, b) => a.page_slug.localeCompare(b.page_slug));
}
