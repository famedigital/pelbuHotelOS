/**
 * Public /gallery filter model — photos tagged by room type, property area,
 * and building facade so the 3D massing can drive the grid.
 */

export const GALLERY_FACADE_IDS = [
  "east",
  "west",
  "south",
  "north",
  "courtyard",
] as const;

export type GalleryFacadeId = (typeof GALLERY_FACADE_IDS)[number];

export type GalleryChipKind = "all" | "room" | "area" | "facade";

export type GalleryChip = {
  id: string;
  label: string;
  kind: GalleryChipKind;
  href: string | null;
  ctaLabel: string | null;
};

export type GalleryPhoto = {
  id: string;
  publicId: string;
  resourceType: "image" | "video";
  posterPublicId: string | null;
  alt: string;
  caption: string | null;
  filterIds: string[];
};

export type GalleryUnitRef = {
  id: string;
  label?: string;
  room_type_code: string;
  facade_side: string | null;
  floor_label: string | null;
};

const FACADE_SET = new Set<string>(GALLERY_FACADE_IDS);

export const GALLERY_CHIP_ORDER: { id: string; label: string; kind: GalleryChipKind }[] =
  [
    { id: "all", label: "All", kind: "all" },
    { id: "dq", label: "King", kind: "room" },
    { id: "dt", label: "Twin", kind: "room" },
    { id: "sr", label: "Suite", kind: "room" },
    { id: "restaurant", label: "Restaurant", kind: "area" },
    { id: "cafe", label: "Bistro", kind: "area" },
    { id: "bar", label: "Bar", kind: "area" },
    { id: "lobby", label: "Lobby", kind: "area" },
    { id: "spa", label: "Spa", kind: "area" },
    { id: "steam", label: "Steam", kind: "area" },
    { id: "meeting", label: "Meeting", kind: "area" },
    { id: "reception", label: "Reception", kind: "area" },
    { id: "exterior", label: "Outside", kind: "area" },
    { id: "nearby", label: "Nearby", kind: "area" },
    { id: "parking", label: "Parking", kind: "area" },
    { id: "east", label: "East face", kind: "facade" },
    { id: "west", label: "West face", kind: "facade" },
    { id: "south", label: "South face", kind: "facade" },
    { id: "north", label: "North face", kind: "facade" },
    { id: "courtyard", label: "Courtyard", kind: "facade" },
  ];

const AREA_HREF: Record<string, { href: string; ctaLabel: string }> = {
  restaurant: { href: "/restaurant", ctaLabel: "Restaurant menu" },
  cafe: { href: "/cafe", ctaLabel: "Bistro & pastry" },
  bar: { href: "/bar", ctaLabel: "Bar" },
  lobby: { href: "/contact", ctaLabel: "About the hotel" },
  spa: { href: "/spa", ctaLabel: "Spa & steam" },
  steam: { href: "/spa", ctaLabel: "Spa & steam" },
  meeting: { href: "/meeting", ctaLabel: "Meeting room" },
  reception: { href: "/contact", ctaLabel: "Contact the desk" },
  exterior: { href: "/stay/olakha-thimphu", ctaLabel: "Stay in Olakha" },
  nearby: { href: "/stay/olakha-thimphu", ctaLabel: "Olakha & Thimphu" },
  parking: { href: "/contact", ctaLabel: "Getting here" },
};

export function isGalleryFacadeId(id: string): id is GalleryFacadeId {
  return FACADE_SET.has(id);
}

export function normalizeGalleryFilter(
  raw: string | null | undefined,
  allowedIds: ReadonlySet<string>,
): string {
  const id = (raw ?? "all").trim().toLowerCase();
  if (id === "all" || allowedIds.has(id)) return id;
  return "all";
}

export function filterGalleryPhotos(
  photos: GalleryPhoto[],
  filter: string,
): GalleryPhoto[] {
  if (filter === "all" || !filter) return photos;
  return photos.filter((p) => p.filterIds.includes(filter));
}

export function selectedUnitIdsForFilter(
  units: GalleryUnitRef[],
  filter: string,
): string[] {
  if (!filter || filter === "all") return [];
  if (isGalleryFacadeId(filter)) {
    return units.filter((u) => u.facade_side === filter).map((u) => u.id);
  }
  return units.filter((u) => u.room_type_code === filter).map((u) => u.id);
}

export const GALLERY_AMENITY_FILTER_IDS = new Set([
  "lobby",
  "reception",
  "restaurant",
  "cafe",
  "bar",
  "spa",
  "steam",
  "meeting",
]);

export function amenityKindToFilter(kind: string): string | null {
  return GALLERY_AMENITY_FILTER_IDS.has(kind) ? kind : null;
}

/** Chip for a filter id — including amenity clicks that have no photos yet. */
export function galleryChipById(
  id: string,
  chips: GalleryChip[],
): GalleryChip | undefined {
  const found = chips.find((c) => c.id === id);
  if (found) return found;
  const meta = GALLERY_CHIP_ORDER.find((c) => c.id === id);
  if (!meta) return undefined;
  if (meta.kind === "area") {
    const dest = AREA_HREF[id];
    return {
      ...meta,
      href: dest?.href ?? null,
      ctaLabel: dest?.ctaLabel ?? null,
    };
  }
  if (meta.kind === "room") {
    return { ...meta, href: null, ctaLabel: null };
  }
  return { ...meta, href: "/rooms", ctaLabel: "Explore rooms" };
}

export function buildGalleryChips(args: {
  photos: GalleryPhoto[];
  rooms: Array<{ code: string; name: string; slug: string }>;
}): GalleryChip[] {
  const present = new Set<string>();
  for (const photo of args.photos) {
    for (const id of photo.filterIds) present.add(id);
  }
  const roomByCode = new Map(args.rooms.map((r) => [r.code, r]));

  return GALLERY_CHIP_ORDER.filter((chip) => {
    if (chip.id === "all") return args.photos.length > 0;
    return present.has(chip.id);
  }).map((chip) => {
    if (chip.kind === "room") {
      const room = roomByCode.get(chip.id);
      return {
        ...chip,
        label: room?.name ?? chip.label,
        href: room ? `/rooms/${room.slug}` : null,
        ctaLabel: room ? `${room.name} details` : null,
      };
    }
    if (chip.kind === "area") {
      const dest = AREA_HREF[chip.id];
      return {
        ...chip,
        href: dest?.href ?? null,
        ctaLabel: dest?.ctaLabel ?? null,
      };
    }
    return { ...chip, href: "/rooms", ctaLabel: "Explore rooms" };
  });
}

export function uniquePhotosByPublicId(photos: GalleryPhoto[]): GalleryPhoto[] {
  const seen = new Set<string>();
  const out: GalleryPhoto[] = [];
  for (const photo of photos) {
    const key = `${photo.resourceType}:${photo.publicId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(photo);
  }
  return out;
}
