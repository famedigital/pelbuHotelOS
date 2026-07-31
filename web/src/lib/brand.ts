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

/** Cloudinary public_ids — logos + curated high-resolution photography. */
export const BRAND_CLOUDINARY = {
  logoPrimary: "pelbu/brand/logo-primary",
  logoFlat: "pelbu/brand/logo-flat",
  logoWordmark: "pelbu/brand/logo-wordmark",
  roomsDeluxe: "pelbu/seven-suites/official-img6149",
  roomsSuperior: "pelbu/seven-suites/official-img6194",
  roomsTwin: "pelbu/seven-suites/official-img6256",
  roomsSuiteAlt: "pelbu/seven-suites/official-dsc08154",
  roomsSuiteView: "pelbu/seven-suites/official-room",
  roomsLiving: "pelbu/seven-suites/official-img6236",
  cafePastry: "pelbu/cafe/morning-pastry",
  pastryKhabzay: "pelbu/menu/cafe-suja-khabzay",
  restaurantPlate: "pelbu/restaurant/signature-plate",
  diningRoom: "pelbu/restaurant/dining-room",
  spaSteam: "pelbu/spa/steam",
  spaJacuzzi: "pelbu/spa/jacuzzi",
  barPour: "pelbu/bar/evening-pour",
  galleryExt: "pelbu/gallery/ta2",
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
 * Homepage hero carousel — prefer official 5K interiors.
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

/** Room detail mosaic tiles keyed by room code slug. */
export const ROOM_GALLERY_BY_CODE: Record<string, readonly string[]> = {
  deluxe: [
    BRAND_CLOUDINARY.roomsDeluxe,
    BRAND_CLOUDINARY.roomsSuiteView,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteAlt,
    "pelbu/seven-suites/official-img6170",
  ],
  superior: [
    BRAND_CLOUDINARY.roomsSuperior,
    BRAND_CLOUDINARY.roomsLiving,
    BRAND_CLOUDINARY.roomsSuiteView,
    "pelbu/seven-suites/official-img6254",
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
};
