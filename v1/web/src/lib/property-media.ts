import type { CloudinaryResourceType } from "@/lib/cloudinary";

/** Who the asset is attached to. */
export const PROPERTY_MEDIA_SCOPES = [
  "room_type",
  "room_unit",
  "property_area",
  "menu_item",
  "staff",
] as const;
export type PropertyMediaScope = (typeof PROPERTY_MEDIA_SCOPES)[number];

/** Room type / unit shot types. */
export const ROOM_FACETS = [
  "overview",
  "beds",
  "linen",
  "amenities",
  "tv",
  "toilet",
  "wardrobe",
  "bathroom",
  "view",
  "other",
] as const;
export type RoomMediaFacet = (typeof ROOM_FACETS)[number];

/** Property-level areas (scope=property_area; scope_id null). */
export const PROPERTY_AREA_FACETS = [
  "lobby",
  "reception",
  "restaurant",
  "cafe",
  "bar",
  "building",
  "facilities",
  "exterior",
  "parking",
  "nearby",
  "spa",
  "steam",
  "meeting",
  "other",
] as const;
export type PropertyAreaFacet = (typeof PROPERTY_AREA_FACETS)[number];

export const FOOD_FACETS = ["plated", "counter", "kitchen", "other"] as const;
export type FoodMediaFacet = (typeof FOOD_FACETS)[number];

export const STAFF_FACETS = ["portrait", "at_work"] as const;
export type StaffMediaFacet = (typeof STAFF_FACETS)[number];

export type PropertyMediaFacet =
  | RoomMediaFacet
  | PropertyAreaFacet
  | FoodMediaFacet
  | StaffMediaFacet;

export const ROOM_FACET_LABELS: Record<RoomMediaFacet, string> = {
  overview: "Room overview",
  beds: "Beds",
  linen: "Linen",
  amenities: "Amenities",
  tv: "TV",
  toilet: "Toilet",
  wardrobe: "Wardrobe",
  bathroom: "Bathroom",
  view: "View",
  other: "Other",
};

export const PROPERTY_AREA_LABELS: Record<PropertyAreaFacet, string> = {
  lobby: "Lobby",
  reception: "Reception",
  restaurant: "Restaurant",
  cafe: "Bistro",
  bar: "Bar",
  building: "Building",
  facilities: "Facilities",
  exterior: "Exterior",
  parking: "Parking",
  nearby: "Nearby",
  spa: "Spa",
  steam: "Steam",
  meeting: "Meeting room",
  other: "Other",
};

export const FOOD_FACET_LABELS: Record<FoodMediaFacet, string> = {
  plated: "Plated dish",
  counter: "Counter / display",
  kitchen: "Kitchen",
  other: "Other",
};

export const STAFF_FACET_LABELS: Record<StaffMediaFacet, string> = {
  portrait: "Portrait",
  at_work: "At work",
};

export function facetLabel(facet: string): string {
  if (facet in ROOM_FACET_LABELS) {
    return ROOM_FACET_LABELS[facet as RoomMediaFacet];
  }
  if (facet in PROPERTY_AREA_LABELS) {
    return PROPERTY_AREA_LABELS[facet as PropertyAreaFacet];
  }
  if (facet in FOOD_FACET_LABELS) {
    return FOOD_FACET_LABELS[facet as FoodMediaFacet];
  }
  if (facet in STAFF_FACET_LABELS) {
    return STAFF_FACET_LABELS[facet as StaffMediaFacet];
  }
  return facet;
}

export function facetsForScope(scope: PropertyMediaScope): readonly string[] {
  switch (scope) {
    case "room_type":
    case "room_unit":
      return ROOM_FACETS;
    case "property_area":
      return PROPERTY_AREA_FACETS;
    case "menu_item":
      return FOOD_FACETS;
    case "staff":
      return STAFF_FACETS;
    default:
      return [];
  }
}

export type PropertyMediaRow = {
  id: string;
  property_id: string;
  scope: PropertyMediaScope;
  scope_id: string | null;
  facet: string;
  public_id: string;
  resource_type: CloudinaryResourceType;
  poster_public_id: string | null;
  duration_sec: number | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  alt: string;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
  is_published: boolean;
};

export const PROPERTY_MEDIA_SELECT =
  "id, property_id, scope, scope_id, facet, public_id, resource_type, poster_public_id, duration_sec, bytes, width, height, format, alt, caption, sort_order, is_primary, is_published";

export function mapPropertyMediaRow(row: Record<string, unknown>): PropertyMediaRow {
  return {
    id: row.id as string,
    property_id: row.property_id as string,
    scope: row.scope as PropertyMediaScope,
    scope_id: (row.scope_id as string | null) ?? null,
    facet: row.facet as string,
    public_id: row.public_id as string,
    resource_type: row.resource_type === "video" ? "video" : "image",
    poster_public_id: (row.poster_public_id as string | null) ?? null,
    duration_sec: row.duration_sec == null ? null : Number(row.duration_sec),
    bytes: row.bytes == null ? null : Number(row.bytes),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    format: (row.format as string | null) ?? null,
    alt: (row.alt as string) ?? "",
    caption: (row.caption as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_primary: Boolean(row.is_primary),
    is_published: Boolean(row.is_published),
  };
}

/** Cloudinary folder for signed uploads under pelbu/. */
export function trustMediaUploadFolder(
  propCode: string,
  scope: PropertyMediaScope,
  facet: string,
): string {
  const code = propCode.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "prop";
  const safeFacet = facet.replace(/[^a-z0-9_]/g, "");
  return `pelbu/${code}/trust/${scope}/${safeFacet}`;
}

/** Public-friendly display sizes for trust media. */
export const TRUST_MEDIA_SIZES = {
  hero: { width: 1600, height: 1000, crop: "fill" as const },
  gallery: { width: 1200, height: 800, crop: "fill" as const },
  thumb: { width: 400, height: 260, crop: "fill" as const },
  portrait: { width: 480, height: 600, crop: "fill" as const },
};
