import { resolveRoomImagePublicId } from "@/lib/brand";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

export type PublicRoom = {
  id: string;
  code: string;
  slug: string;
  name: string;
  blurb: string | null;
  imagePublicId: string | null;
  imageSrc: string | null;
};

export type GuidePost = {
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverSrc: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  authorName: string | null;
};

export function publicRoomSlug(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function loadPublicRooms(): Promise<PublicRoom[]> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("room_types")
    .select("id, code, name, blurb, image_public_id")
    .eq("property_id", propertyId)
    .eq("inventory_kind", "sellable_guest")
    .order("code");

  return (data ?? []).map((row) => {
    const code = row.code as string;
    const name = row.name as string;
    const publicId = resolveRoomImagePublicId({
      code,
      name,
      imagePublicId: (row.image_public_id as string | null) ?? null,
    });
    return {
      id: row.id as string,
      code,
      slug: publicRoomSlug(code),
      name,
      blurb: (row.blurb as string | null) ?? null,
      imagePublicId: publicId,
      imageSrc: cloudinaryUrl(publicId, { width: 1400, crop: "fill" }),
    };
  });
}

export async function loadPublicRoom(slug: string): Promise<PublicRoom | null> {
  const rooms = await loadPublicRooms();
  return rooms.find((room) => room.slug === slug) ?? null;
}

export async function loadGuidePosts(): Promise<GuidePost[]> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_posts")
    .select(
      "slug, title, excerpt, body_md, cover_public_id, meta_description, published_at, updated_at, author_name",
    )
    .eq("property_id", propertyId)
    .eq("content_type", "guide")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return (data ?? []).map(mapPost);
}

export async function loadGuidePost(slug: string): Promise<GuidePost | null> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("cms_posts")
    .select(
      "slug, title, excerpt, body_md, cover_public_id, meta_description, published_at, updated_at, author_name",
    )
    .eq("property_id", propertyId)
    .eq("content_type", "guide")
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();
  return data ? mapPost(data) : null;
}

function mapPost(row: Record<string, unknown>): GuidePost {
  const publicId = (row.cover_public_id as string | null) ?? null;
  return {
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    bodyMd: row.body_md as string,
    coverSrc: publicId
      ? cloudinaryUrl(publicId, { width: 1400, crop: "fill" })
      : null,
    metaDescription: (row.meta_description as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
    authorName: (row.author_name as string | null) ?? null,
  };
}
