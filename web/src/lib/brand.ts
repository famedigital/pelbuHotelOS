/**
 * Pelbu brand asset map — local icons for chrome/PWA; Cloudinary for photography.
 * Prefer these constants over hardcoding paths in components.
 */

/** Favicon + PWA icons under `web/public/icons` (knot mark). */
export const BRAND_ICONS = {
  favicon: "/favicon.ico",
  favicon16: "/icons/favicon-16.png",
  favicon32: "/icons/favicon-32.png",
  /** Knot mark — use on dark/espresso chrome (header, ERP). */
  mark: "/icons/icon-192.png",
  markLg: "/icons/icon-512.png",
  appleTouch: "/icons/apple-touch-icon.png",
} as const;

/** @deprecated use BRAND_ICONS.mark */
export const BRAND_LOGO_MARK = BRAND_ICONS.mark;
export const BRAND_FAVICON = BRAND_ICONS.favicon;

/** Cloudinary public_ids — logos + curated photography. */
export const BRAND_CLOUDINARY = {
  logoPrimary: "pelbu/brand/logo-primary",
  logoFlat: "pelbu/brand/logo-flat",
  logoWordmark: "pelbu/brand/logo-wordmark",
  /** Prefer room/cafe/spa for heroes — `hotel/exterior` is a mislabeled dining shot. */
  roomsDeluxe: "pelbu/rooms/deluxe",
  roomsSuperior: "pelbu/rooms/superior",
  roomsTwin: "pelbu/rooms/twin",
  roomsSuiteAlt: "pelbu/rooms/suite-alt",
  cafePastry: "pelbu/cafe/morning-pastry",
  restaurantPlate: "pelbu/restaurant/signature-plate",
  spaSteam: "pelbu/spa/steam",
  spaJacuzzi: "pelbu/spa/jacuzzi",
  barPour: "pelbu/bar/evening-pour",
  diningRoom: "pelbu/restaurant/dining-room",
} as const;

export type HeroSlide = {
  publicId: string;
  alt: string;
  label: string;
};

/**
 * Homepage hero carousel — high-res interiors only.
 * Do not use `pelbu/hotel/exterior` (wrong asset / weak hero).
 */
export const HOME_HERO_SLIDES: readonly HeroSlide[] = [
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
    publicId: BRAND_CLOUDINARY.roomsSuiteAlt,
    alt: "Suite with ensuite bath",
    label: "Suite",
  },
  {
    publicId: BRAND_CLOUDINARY.cafePastry,
    alt: "Cafe and pastry at Pelbu",
    label: "Cafe",
  },
  {
    publicId: BRAND_CLOUDINARY.restaurantPlate,
    alt: "Restaurant plate at Pelbu",
    label: "Restaurant",
  },
  {
    publicId: BRAND_CLOUDINARY.spaSteam,
    alt: "Spa and steam at Pelbu",
    label: "Spa",
  },
] as const;

/** Public stream tiles on the home page (one image per outlet). */
export const HOME_STREAM_IMAGES = [
  { href: "/rooms", title: "Rooms", blurb: "Rest well in Olakha — book direct for the best rate.", publicId: BRAND_CLOUDINARY.roomsDeluxe },
  { href: "/cafe", title: "Cafe & Pastry", blurb: "Opens 6:30 summer / 7:30 winter. Order for taxi delivery.", publicId: BRAND_CLOUDINARY.cafePastry },
  { href: "/restaurant", title: "Restaurant", blurb: "Indian, Bhutanese, and multicuisine — breakfast to dinner.", publicId: BRAND_CLOUDINARY.restaurantPlate },
  { href: "/bar", title: "Bar", blurb: "Weekend menu and a calm evening pour.", publicId: BRAND_CLOUDINARY.barPour },
  { href: "/spa", title: "Spa & Steam", blurb: "Book treatments and steam — restore after the road.", publicId: BRAND_CLOUDINARY.spaSteam },
  { href: "/meeting", title: "Meeting", blurb: "Premium hall for up to 25 — chairs, table, focus.", publicId: BRAND_CLOUDINARY.roomsSuperior },
] as const;
