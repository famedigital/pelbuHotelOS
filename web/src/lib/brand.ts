/**
 * Platform brand assets — local icons for chrome/PWA.
 * Cloudinary paths below are optional defaults; tenants override via Settings.
 */

/**
 * Bump when replacing files under `web/public/icons` so browsers/PWA drop stale caches.
 * Keep in sync with `?v=` on icons in `*.webmanifest` and SW precache lists.
 */
export const BRAND_ICON_VERSION = "20260915";

function iconPath(path: string): string {
  return `${path}?v=${BRAND_ICON_VERSION}`;
}

/** Favicon + PWA icons under `web/public/icons`. */
export const BRAND_ICONS = {
  favicon: iconPath("/favicon.ico"),
  favicon16: iconPath("/icons/favicon-16.png"),
  favicon32: iconPath("/icons/favicon-32.png"),
  /** Primary SVG silhouette mark — light backgrounds / general chrome. */
  mark: iconPath("/icons/bho-mark.svg"),
  /** SVG mark for dark chrome (header, hero, night ERP chrome). */
  markLight: iconPath("/icons/bho-mark-light.svg"),
  /** Raster mark for img contexts that need PNG (PWA / OG). */
  markRaster: iconPath("/icons/icon-192.png"),
  markLg: iconPath("/icons/icon-512.png"),
  markMaskable: iconPath("/icons/icon-512-maskable.png"),
  appleTouch: iconPath("/icons/apple-touch-icon.png"),
} as const;

/** @deprecated use BRAND_ICONS.mark */
export const BRAND_LOGO_MARK = BRAND_ICONS.mark;
export const BRAND_FAVICON = BRAND_ICONS.favicon;

/**
 * Optional Cloudinary public_id defaults (tenant Settings overrides).
 * Kept for ERP/print helpers that still reference curated folder names.
 */
export const BRAND_CLOUDINARY = {
  logoPrimary: "hotel/brand/logo-primary",
  logoLegacy: "hotel/brand/logo-primary",
  logoFlat: "hotel/brand/logo-flat",
  logoWordmark: "hotel/brand/logo-wordmark",
  roomsDeluxe: "hotel/rooms/deluxe",
  roomsSuperior: "hotel/rooms/superior",
  roomsTwin: "hotel/rooms/twin",
  roomsSuiteAlt: "hotel/rooms/suite-alt",
  roomsSuiteView: "hotel/rooms/suite-view",
  roomsLiving: "hotel/rooms/superior-living",
  cafePastry: "hotel/cafe/morning-pastry",
  pastryKhabzay: "hotel/menu/cafe-suja-khabzay",
  restaurantPlate: "hotel/restaurant/signature-plate",
  diningRoom: "hotel/restaurant/dining-room",
  spaSteam: "hotel/spa/steam",
  spaJacuzzi: "hotel/spa/jacuzzi",
  barPour: "hotel/bar/evening-pour",
  galleryExt: "hotel/gallery/exterior",
  hotelExterior: "hotel/hotel/exterior",
  hotelExteriorAlt: "hotel/gallery/exterior-alt",
} as const;

/** Public website removed — empty stubs for leftover CMS helpers. */
export const OUTLET_SHOWCASE_PHOTOS = {
  restaurant: [] as { publicId: string; alt: string }[],
  cafe: [] as { publicId: string; alt: string }[],
  pastry: [] as { publicId: string; alt: string }[],
} as const;

export type HeroSlide = {
  publicId: string;
  alt: string;
  label: string;
};

/** Public website removed — no default hero slides. */
export const HOME_HERO_SLIDES: readonly HeroSlide[] = [];

/** Room gallery fallbacks by code (tenant CMS / Settings preferred). */
export const ROOM_GALLERY_BY_CODE: Record<string, readonly string[]> = {};

const ROOM_HERO_BY_CODE: Record<string, string> = {};

/**
 * Resolve a Cloudinary public_id for a room type card or gallery lead.
 * DB `image_public_id` wins; otherwise map known codes / name heuristics.
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
