import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cloudinaryUrl } from "@/lib/cloudinary";

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
};

export type CmsMediaItem = {
  id: string;
  public_id: string;
  alt: string;
  kind: string;
  sort_order: number;
  /** Resolved Cloudinary URL, or null if cloud env missing */
  src: string | null;
};

export async function loadCmsPage(slug: string): Promise<CmsPage | null> {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return null;

  const { data } = await admin
    .from("cms_pages")
    .select(
      "slug, eyebrow, title, body, hours_note, primary_cta_href, primary_cta_label, secondary_cta_href, secondary_cta_label, meta_description",
    )
    .eq("property_id", property.id)
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
  };
}

export async function loadCmsGallery(
  pageSlug: string,
  width = 960,
): Promise<CmsMediaItem[]> {
  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) return [];

  const { data } = await admin
    .from("cms_media")
    .select("id, public_id, alt, kind, sort_order")
    .eq("property_id", property.id)
    .eq("page_slug", pageSlug)
    .eq("is_published", true)
    .order("sort_order");

  return (data ?? []).map((row) => {
    const publicId = row.public_id as string;
    return {
      id: row.id as string,
      public_id: publicId,
      alt: (row.alt as string) || "",
      kind: row.kind as string,
      sort_order: Number(row.sort_order),
      src: cloudinaryUrl(publicId, { width, crop: "fill" }),
    };
  });
}
