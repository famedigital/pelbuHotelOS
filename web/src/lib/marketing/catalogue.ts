import "server-only";
import { cloudinaryUrl } from "@/lib/cloudinary";
import {
  getCatalogueTemplate,
  type CatalogueSectionDraft,
  type CatalogueTemplateCode,
} from "@/lib/marketing/catalogue-templates";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MarketingCatalogueRow = {
  id: string;
  property_id: string;
  template_code: CatalogueTemplateCode;
  title: string;
  slug: string;
  season_label: string | null;
  audience: "public" | "agents" | "media_press";
  status: "draft" | "published" | "archived";
  cover_public_id: string | null;
  intro_blurb: string | null;
  caption_feed: string | null;
  caption_story: string | null;
  caption_agent: string | null;
  hashtags: string | null;
  cta_kind: "book" | "order" | "contact" | "custom";
  cta_href: string | null;
  cta_label: string | null;
  promo_code_id: string | null;
  show_public_rates: boolean;
  view_count: number;
  social_download_count: number;
  published_at: string | null;
  sections: CatalogueSectionDraft[];
  updated_at: string;
};

export type CatalogueResolvedContent = {
  catalogue: MarketingCatalogueRow;
  template: ReturnType<typeof getCatalogueTemplate>;
  property: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    whatsapp: string | null;
    mapsUrl: string | null;
    logoPublicId: string | null;
    instagram: string | null;
    facebook: string | null;
  };
  promoCode: string | null;
  coverPublicId: string | null;
  coverSrc: string | null;
  rooms: {
    code: string;
    name: string;
    blurb: string | null;
    imagePublicId: string | null;
    imageSrc: string | null;
  }[];
  menuItems: {
    id: string;
    name: string;
    description: string | null;
    priceBtn: number;
    outlet: string;
    imagePublicId: string | null;
    imageSrc: string | null;
  }[];
  offerings: {
    id: string;
    kind: string;
    name: string;
    description: string | null;
    priceBtn: number | null;
    imagePublicId: string | null;
    imageSrc: string | null;
  }[];
  gallery: { publicId: string; src: string; alt: string }[];
  ctaHref: string;
  ctaLabel: string;
};

function mapRow(raw: Record<string, unknown>): MarketingCatalogueRow {
  const sections = Array.isArray(raw.sections)
    ? (raw.sections as CatalogueSectionDraft[])
    : [];
  return {
    id: raw.id as string,
    property_id: raw.property_id as string,
    template_code: raw.template_code as CatalogueTemplateCode,
    title: raw.title as string,
    slug: raw.slug as string,
    season_label: (raw.season_label as string | null) ?? null,
    audience: raw.audience as MarketingCatalogueRow["audience"],
    status: raw.status as MarketingCatalogueRow["status"],
    cover_public_id: (raw.cover_public_id as string | null) ?? null,
    intro_blurb: (raw.intro_blurb as string | null) ?? null,
    caption_feed: (raw.caption_feed as string | null) ?? null,
    caption_story: (raw.caption_story as string | null) ?? null,
    caption_agent: (raw.caption_agent as string | null) ?? null,
    hashtags: (raw.hashtags as string | null) ?? null,
    cta_kind: raw.cta_kind as MarketingCatalogueRow["cta_kind"],
    cta_href: (raw.cta_href as string | null) ?? null,
    cta_label: (raw.cta_label as string | null) ?? null,
    promo_code_id: (raw.promo_code_id as string | null) ?? null,
    show_public_rates: Boolean(raw.show_public_rates),
    view_count: Number(raw.view_count ?? 0),
    social_download_count: Number(raw.social_download_count ?? 0),
    published_at: (raw.published_at as string | null) ?? null,
    sections,
    updated_at: raw.updated_at as string,
  };
}

export function slugifyCatalogueTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function listCataloguesForProperty(
  admin: Admin,
  propertyId: string,
): Promise<MarketingCatalogueRow[]> {
  const { data } = await admin
    .from("marketing_catalogues")
    .select("*")
    .eq("property_id", propertyId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function loadPublishedCatalogueBySlug(
  admin: Admin,
  slug: string,
): Promise<MarketingCatalogueRow | null> {
  const { data } = await admin
    .from("marketing_catalogues")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

function sectionEnabled(
  sections: CatalogueSectionDraft[],
  type: CatalogueSectionDraft["type"],
): boolean {
  const s = sections.find((x) => x.type === type);
  return s ? s.enabled !== false : false;
}

function sectionItemIds(
  sections: CatalogueSectionDraft[],
  type: CatalogueSectionDraft["type"],
): string[] | null {
  const s = sections.find((x) => x.type === type);
  if (!s?.item_ids?.length) return null;
  return s.item_ids;
}

export async function resolveCatalogueContent(
  admin: Admin,
  catalogue: MarketingCatalogueRow,
): Promise<CatalogueResolvedContent> {
  const template = getCatalogueTemplate(catalogue.template_code);
  const propertyId = catalogue.property_id;

  const [
    { data: prop },
    { data: roomRows },
    { data: menuRows },
    { data: offerRows },
    { data: mediaRows },
    { data: promo },
  ] = await Promise.all([
    admin
      .from("properties")
      .select(
        "name, phone, email, address, whatsapp, maps_url, logo_public_id, instagram_handle, facebook_url",
      )
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("room_types")
      .select("id, code, name, blurb, image_public_id")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code"),
    admin
      .from("menu_items")
      .select(
        "id, name, description, price_btn, outlet, image_public_id, is_popular, is_available",
      )
      .eq("property_id", propertyId)
      .eq("is_available", true)
      .order("sort_order")
      .limit(80),
    admin
      .from("service_offerings")
      .select(
        "id, kind, name, description, price_btn, image_public_id, is_active",
      )
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order")
      .limit(40),
    admin
      .from("cms_media")
      .select("public_id, alt, page_slug, kind, resource_type")
      .eq("property_id", propertyId)
      .eq("is_published", true)
      .eq("resource_type", "image")
      .in("page_slug", ["home", "gallery", "rooms"])
      .order("sort_order")
      .limit(24),
    catalogue.promo_code_id
      ? admin
          .from("promo_codes")
          .select("code")
          .eq("id", catalogue.promo_code_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const roomIds = sectionItemIds(catalogue.sections, "rooms");
  type RoomT = {
    id: string;
    code: string;
    name: string;
    blurb: string | null;
    imagePublicId: string | null;
    imageSrc: string | null;
  };
  let rooms: RoomT[] = (roomRows ?? []).map((r) => {
    const publicId = (r.image_public_id as string | null) ?? null;
    return {
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      blurb: (r.blurb as string | null) ?? null,
      imagePublicId: publicId,
      imageSrc: publicId
        ? cloudinaryUrl(publicId, { width: 1200, height: 900, crop: "fill" })
        : null,
    };
  });
  if (roomIds) {
    rooms = rooms.filter(
      (r) => roomIds.includes(r.code) || roomIds.includes(r.id),
    );
  } else if (!sectionEnabled(catalogue.sections, "rooms")) {
    rooms = [];
  }

  type MenuT = {
    id: string;
    name: string;
    description: string | null;
    priceBtn: number;
    outlet: string;
    imagePublicId: string | null;
    imageSrc: string | null;
    isPopular: boolean;
  };
  let menuItems: MenuT[] = (menuRows ?? []).map((m) => {
    const publicId = (m.image_public_id as string | null) ?? null;
    return {
      id: m.id as string,
      name: m.name as string,
      description: (m.description as string | null) ?? null,
      priceBtn: Number(m.price_btn),
      outlet: m.outlet as string,
      imagePublicId: publicId,
      imageSrc: publicId
        ? cloudinaryUrl(publicId, { width: 800, height: 800, crop: "fill" })
        : null,
      isPopular: Boolean(m.is_popular),
    };
  });
  if (menuIdsFiltered(catalogue.sections)) {
    const ids = sectionItemIds(catalogue.sections, "fnb")!;
    menuItems = menuItems.filter((m) => ids.includes(m.id));
  } else if (sectionEnabled(catalogue.sections, "fnb")) {
    const popular = menuItems.filter((m) => m.isPopular);
    menuItems = (popular.length ? popular : menuItems).slice(0, 12);
  } else {
    menuItems = [];
  }

  const spaOn = sectionEnabled(catalogue.sections, "spa");
  const meetingOn = sectionEnabled(catalogue.sections, "meeting");
  let offerings = (offerRows ?? []).map((o) => {
    const publicId = (o.image_public_id as string | null) ?? null;
    return {
      id: o.id as string,
      kind: o.kind as string,
      name: o.name as string,
      description: (o.description as string | null) ?? null,
      priceBtn: o.price_btn == null ? null : Number(o.price_btn),
      imagePublicId: publicId,
      imageSrc: publicId
        ? cloudinaryUrl(publicId, { width: 900, height: 700, crop: "fill" })
        : null,
    };
  });
  if (!spaOn && !meetingOn) {
    offerings = [];
  } else {
    offerings = offerings.filter((o) => {
      if (o.kind === "spa" || o.kind === "steam") return spaOn;
      if (o.kind === "meeting") return meetingOn;
      return true;
    });
  }

  const gallery =
    sectionEnabled(catalogue.sections, "gallery")
      ? ((mediaRows ?? [])
          .map((m) => {
            const publicId = m.public_id as string;
            const src = cloudinaryUrl(publicId, {
              width: 1400,
              height: 1000,
              crop: "fill",
            });
            if (!src) return null;
            return {
              publicId,
              src,
              alt: (m.alt as string) || catalogue.title,
            };
          })
          .filter(Boolean) as {
          publicId: string;
          src: string;
          alt: string;
        }[])
      : [];

  const coverId =
    catalogue.cover_public_id ||
    gallery[0]?.publicId ||
    rooms.find((r) => r.imagePublicId)?.imagePublicId ||
    null;

  const cta = resolveCta(catalogue);
  const ig = prop?.instagram_handle as string | null;
  const igUrl = ig
    ? ig.startsWith("http")
      ? ig
      : `https://instagram.com/${ig.replace(/^@/, "")}`
    : null;

  return {
    catalogue,
    template,
    property: {
      name: (prop?.name as string) || "Hotel",
      phone: (prop?.phone as string | null) ?? null,
      email: (prop?.email as string | null) ?? null,
      address: (prop?.address as string | null) ?? null,
      whatsapp: (prop?.whatsapp as string | null) ?? null,
      mapsUrl: (prop?.maps_url as string | null) ?? null,
      logoPublicId: (prop?.logo_public_id as string | null) ?? null,
      instagram: igUrl,
      facebook: (prop?.facebook_url as string | null) ?? null,
    },
    promoCode: (promo?.code as string | null) ?? null,
    coverPublicId: coverId,
    coverSrc: coverId
      ? cloudinaryUrl(coverId, { width: 1600, height: 1000, crop: "fill" })
      : null,
    rooms: rooms.map(({ id: _id, ...rest }) => rest),
    menuItems: menuItems.map(({ isPopular: _p, ...rest }) => rest),
    offerings,
    gallery,
    ctaHref: cta.href,
    ctaLabel: cta.label,
  };
}

function menuIdsFiltered(sections: CatalogueSectionDraft[]): boolean {
  return Boolean(sectionItemIds(sections, "fnb")?.length);
}

function resolveCta(catalogue: MarketingCatalogueRow): {
  href: string;
  label: string;
} {
  const customLabel = catalogue.cta_label?.trim();
  switch (catalogue.cta_kind) {
    case "order":
      return { href: "/menu", label: customLabel || "Order" };
    case "contact":
      return { href: "/contact", label: customLabel || "Contact us" };
    case "custom":
      return {
        href: catalogue.cta_href?.trim() || "/book",
        label: customLabel || "Learn more",
      };
    case "book":
    default:
      return { href: "/book", label: customLabel || "Book stay" };
  }
}

export async function recordCatalogueView(
  admin: Admin,
  catalogueId: string,
): Promise<void> {
  await admin.rpc("marketing_catalogue_record_view", {
    p_catalogue_id: catalogueId,
  });
}

export async function recordCatalogueSocialDl(
  admin: Admin,
  catalogueId: string,
): Promise<void> {
  await admin.rpc("marketing_catalogue_record_social_dl", {
    p_catalogue_id: catalogueId,
  });
}
