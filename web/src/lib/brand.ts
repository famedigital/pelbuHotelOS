/**
 * Pelbu brand asset map — local icons for chrome/PWA; Cloudinary for photography.
 * Prefer these constants over hardcoding paths in components.
 */

/**
 * Bump when replacing files under `web/public/icons` so browsers/PWA drop stale caches.
 * Keep in sync with `?v=` on icons in `*.webmanifest` and SW precache lists.
 */
export const BRAND_ICON_VERSION = "20260804";

function iconPath(path: string): string {
  return `${path}?v=${BRAND_ICON_VERSION}`;
}

/** Favicon + PWA icons under `web/public/icons` (primary brand mark). */
export const BRAND_ICONS = {
  favicon: iconPath("/favicon.ico"),
  favicon16: iconPath("/icons/favicon-16.png"),
  favicon32: iconPath("/icons/favicon-32.png"),
  /** Brand mark — use on dark/espresso chrome (header, ERP fallback). */
  mark: iconPath("/icons/icon-192.png"),
  markLg: iconPath("/icons/icon-512.png"),
  markMaskable: iconPath("/icons/icon-512-maskable.png"),
  appleTouch: iconPath("/icons/apple-touch-icon.png"),
} as const;

/** @deprecated use BRAND_ICONS.mark */
export const BRAND_LOGO_MARK = BRAND_ICONS.mark;
export const BRAND_FAVICON = BRAND_ICONS.favicon;

/** Cloudinary public_ids — logos + curated high-resolution photography. */
export const BRAND_CLOUDINARY = {
  /** Live Settings → Identity logo (ERP desk + printed docs source of truth). */
  logoPrimary: "pelbu/brand/h2q193tfpc5qrgchfjj1",
  /** Legacy alias still used in some older uploads. */
  logoLegacy: "pelbu/brand/logo-primary",
  logoFlat: "pelbu/brand/logo-flat",
  logoWordmark: "pelbu/brand/logo-wordmark",
  /** Named room-category heroes (`pelbu/rooms/*`) — not the “official-img*”
   * gallery dump (bar / F&B / people), which was remapped onto room categories by
   * mistake and showed wrong cards on the public site. */
  roomsDeluxe: "pelbu/rooms/deluxe",
  roomsSuperior: "pelbu/rooms/superior",
  roomsTwin: "pelbu/rooms/twin",
  roomsSuiteAlt: "pelbu/rooms/suite-alt",
  roomsSuiteView: "pelbu/rooms/suite-view",
  roomsLiving: "pelbu/rooms/superior-living",
  cafePastry: "pelbu/cafe/morning-pastry",
  pastryKhabzay: "pelbu/menu/cafe-suja-khabzay",
  restaurantPlate: "pelbu/restaurant/signature-plate",
  diningRoom: "pelbu/restaurant/dining-room",
  spaSteam: "pelbu/spa/steam",
  spaJacuzzi: "pelbu/spa/jacuzzi",
  barPour: "pelbu/bar/evening-pour",
  galleryExt: "pelbu/gallery/ta2",
  /** Building exterior — preferred first hero / brand place shot. */
  hotelExterior: "pelbu/hotel/exterior",
  hotelExteriorAlt: "pelbu/gallery/ext11",
} as const;

/** Known-good Cloudinary IDs for homepage outlet slideshows.
 *  Restaurant/pastry dish seed IDs that never landed on the CDN are remapped
 *  in `20260731000006_remap_broken_menu_images.sql` and `menu-loader.ts`. */
export const OUTLET_SHOWCASE_PHOTOS = {
  restaurant: [
    { publicId: "pelbu/restaurant/dining-room", alt: "Pelbu Suites dining room" },
    { publicId: "pelbu/restaurant/signature-plate", alt: "Signature restaurant plate" },
    { publicId: "pelbu/menu/cafe-ema-datshi-rice-bowl", alt: "Ema datshi rice bowl" },
    { publicId: "pelbu/menu/cafe-grilled-chicken-plate", alt: "Grilled chicken plate" },
    { publicId: "pelbu/menu/cafe-chicken-momos", alt: "Chicken momos" },
  ],
  cafe: [
    { publicId: "pelbu/cafe/morning-pastry", alt: "Morning coffee and pastry" },
    { publicId: "pelbu/menu/cafe-suja-khabzay", alt: "Suja and khabzay" },
    { publicId: "pelbu/menu/cafe-himalayan-oats-bowl", alt: "Himalayan oats bowl" },
    { publicId: "pelbu/menu/cafe-egg-cheese-paratha", alt: "Egg and cheese paratha" },
    { publicId: "pelbu/menu/cafe-olakha-club-sandwich", alt: "Olakha club sandwich" },
  ],
  pastry: [
    { publicId: "pelbu/cafe/morning-pastry", alt: "Fresh morning pastry" },
    { publicId: "pelbu/restaurant/signature-plate", alt: "In-house bake plate" },
    { publicId: "pelbu/menu/cafe-himalayan-oats-bowl", alt: "Breakfast bake bowl" },
    { publicId: "pelbu/menu/cafe-egg-cheese-paratha", alt: "Warm bakery plate" },
  ],
} as const;

export type HeroSlide = {
  publicId: string;
  alt: string;
  label: string;
};

/**
 * Homepage hero carousel — hotel exterior first, then curated interiors/outlets.
 * Live slider prefers `cms_media` rows with kind=hero when any exist.
 */
export const HOME_HERO_SLIDES: readonly HeroSlide[] = [
  {
    publicId: BRAND_CLOUDINARY.hotelExterior,
    alt: "Pelbu Suites hotel exterior, Olakha Thimphu",
    label: "Pelbu Suites",
  },
  {
    publicId: BRAND_CLOUDINARY.hotelExteriorAlt,
    alt: "Pelbu Suites building exterior",
    label: "Hotel",
  },
  {
    publicId: BRAND_CLOUDINARY.roomsDeluxe,
    alt: "Deluxe suite with mountain view",
    label: "Deluxe suite",
  },
  {
    publicId: BRAND_CLOUDINARY.roomsSuperior,
    alt: "Superior room at Pelbu Suites",
    label: "Superior room",
  },
  {
    publicId: BRAND_CLOUDINARY.roomsTwin,
    alt: "Twin room at Pelbu Suites",
    label: "Twin room",
  },
  {
    publicId: BRAND_CLOUDINARY.diningRoom,
    alt: "Dining room at Pelbu Suites",
    label: "Restaurant",
  },
  {
    publicId: BRAND_CLOUDINARY.cafePastry,
    alt: "Cafe and pastry at Pelbu",
    label: "Cafe",
  },
  {
    publicId: BRAND_CLOUDINARY.spaSteam,
    alt: "Spa and steam at Pelbu",
    label: "Spa",
  },
] as const;

/** Room detail mosaic tiles keyed by room code (live codes + legacy slugs). */
export const ROOM_GALLERY_BY_CODE: Record<string, readonly string[]> = {
  deluxe: [
    BRAND_CLOUDINARY.roomsDeluxe,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteAlt,
    BRAND_CLOUDINARY.roomsSuperior,
  ],
  superior: [
    BRAND_CLOUDINARY.roomsSuperior,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsDeluxe,
  ],
  twin: [
    BRAND_CLOUDINARY.roomsTwin,
    BRAND_CLOUDINARY.roomsSuperior,
    BRAND_CLOUDINARY.roomsSuiteAlt,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsDeluxe,
  ],
  "deluxe-suite": [
    BRAND_CLOUDINARY.roomsSuiteAlt,
    BRAND_CLOUDINARY.roomsDeluxe,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuperior,
  ],
  /** Live sellable codes at Pelbu Suites Olakha. */
  dd: [
    BRAND_CLOUDINARY.roomsSuperior,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsDeluxe,
  ],
  ds: [
    BRAND_CLOUDINARY.roomsSuiteAlt,
    BRAND_CLOUDINARY.roomsDeluxe,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsLiving,
  ],
  dt: [
    BRAND_CLOUDINARY.roomsTwin,
    BRAND_CLOUDINARY.roomsSuperior,
    BRAND_CLOUDINARY.roomsSuiteAlt,
    BRAND_CLOUDINARY.roomsLiving,
  ],
  "d&g": [
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsSuperior,
  ],
};

/** Primary hero photo by room code when CMS/DB has no image_public_id. */
const ROOM_HERO_BY_CODE: Record<string, string> = {
  deluxe: BRAND_CLOUDINARY.roomsDeluxe,
  superior: BRAND_CLOUDINARY.roomsSuperior,
  twin: BRAND_CLOUDINARY.roomsTwin,
  "deluxe-suite": BRAND_CLOUDINARY.roomsSuiteAlt,
  dd: BRAND_CLOUDINARY.roomsSuperior,
  ds: BRAND_CLOUDINARY.roomsSuiteAlt,
  dt: BRAND_CLOUDINARY.roomsTwin,
  "d&g": BRAND_CLOUDINARY.roomsLiving,
  guide: BRAND_CLOUDINARY.roomsSuiteView,
  driver: BRAND_CLOUDINARY.roomsLiving,
};

/**
 * Resolve a Cloudinary public_id for a room type card or gallery lead.
 * DB `image_public_id` wins; otherwise map known codes / name heuristics
 * onto curated Pelbu photography so public lists never render text-only.
 */
export function resolveRoomImagePublicId(args: {
  code: string;
  name?: string | null;
  imagePublicId?: string | null;
}): string {
  const stored = args.imagePublicId?.trim();
  if (stored) return stored;

  const code = args.code.trim().toLowerCase();
  if (ROOM_HERO_BY_CODE[code]) return ROOM_HERO_BY_CODE[code];

  const galleryLead = ROOM_GALLERY_BY_CODE[code]?.[0];
  if (galleryLead) return galleryLead;

  const name = (args.name ?? "").toLowerCase();
  if (name.includes("suite")) return BRAND_CLOUDINARY.roomsSuiteAlt;
  if (name.includes("twin")) return BRAND_CLOUDINARY.roomsTwin;
  if (name.includes("double") || name.includes("superior")) {
    return BRAND_CLOUDINARY.roomsSuperior;
  }
  if (name.includes("deluxe")) return BRAND_CLOUDINARY.roomsDeluxe;
  if (name.includes("guide") || name.includes("driver")) {
    return BRAND_CLOUDINARY.roomsLiving;
  }

  return BRAND_CLOUDINARY.roomsDeluxe;
}

