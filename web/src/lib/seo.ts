import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { shareSocialMeta } from "@/lib/og-share";
import type { Metadata } from "next";

/** Natural keyword clusters — used in titles/descriptions, never pure stacking. */
export const SEO_LOCALE = "Olakha, Thimphu, Bhutan";

/**
 * Default SERP copy for public routes (title without brand — root template adds “| BHO”).
 * CMS seo_title / meta_description override these when present.
 */
export const PAGE_SEO = {
  home: {
    title: "Hotel in Thimphu | Best place to stay in Olakha",
    description:
      "Looking for a good place to stay in Thimphu? Pelbu Suites in Olakha offers quiet rooms, live availability, direct rates, restaurant, cafe, spa and steam under one roof in Bhutan.",
  },
  rooms: {
    title: "Rooms & suites in Thimphu | Place to sleep in Olakha",
    description:
      "Book a quiet room or suite at Pelbu Suites, Olakha Thimphu — good facilities for short city stays, live availability, direct rates, and complimentary guide/driver beds for agent groups.",
  },
  rates: {
    title: "Hotel rates in Thimphu | Public rack prices",
    description:
      "Transparent room rates and meal packages at Pelbu Suites Olakha, Thimphu. Peak, lean and off-season BAR — book direct for the published rack.",
  },
  restaurant: {
    title: "Restaurant in Thimphu | Indian, Bhutanese & multicuisine",
    description:
      "Good food in Olakha, Thimphu: Indian, Bhutanese and multicuisine restaurant at Pelbu Suites — lunch package for tour groups, table service, pickup and taxi delivery.",
  },
  cafe: {
    title: "Cafe & pastry in Thimphu | Coffee and breakfast",
    description:
      "Cafe and pastry at Pelbu Suites Olakha — coffee, breakfast and oven-fresh pastry in Thimphu. Order for stay guests, walk-in pickup or taxi delivery.",
  },
  bar: {
    title: "Bar in Olakha, Thimphu | Calm pours",
    description:
      "Hotel bar at Pelbu Suites Olakha, Thimphu — a calm place for guests and neighbours after a day in the capital.",
  },
  menu: {
    title: "Menu & order food in Thimphu | Cafe · restaurant · bar",
    description:
      "Browse live menus and order good food from Pelbu Suites in Olakha, Thimphu — cafe, pastry, restaurant and bar for pickup or taxi delivery.",
  },
  spa: {
    title: "Spa & steam in Thimphu | Wellness on site",
    description:
      "Spa and steam at Pelbu Suites Olakha, Thimphu — recover after sightseeing with hotel wellness facilities open to guests and day visitors.",
  },
  meeting: {
    title: "Meeting room in Thimphu | Olakha",
    description:
      "Book a meeting room at Pelbu Suites Olakha, Thimphu — practical facilities for small groups with F&B support on site.",
  },
  contact: {
    title: "Contact & about | Hotel desk in Olakha, Thimphu",
    description:
      "Contact Pelbu Suites in Olakha, Thimphu — phone, WhatsApp, map and about the hotel: rooms, dining, spa and good service in one place.",
  },
  faq: {
    title: "Hotel FAQ | Booking, stay & dining in Thimphu",
    description:
      "Practical answers about staying at Pelbu Suites in Olakha, Thimphu — booking, check-in, food, spa, facilities and agent groups.",
  },
  hotelThimphu: {
    title: "Best hotels in Thimphu & place to stay | Olakha",
    description:
      "Searching for the best place to stay or sleep in Thimphu? Pelbu Suites in Olakha combines quiet rooms, good facilities, restaurant, cafe and spa — book direct with live availability.",
  },
  foodThimphu: {
    title: "Best food in Thimphu | Restaurant & cafe in Olakha",
    description:
      "Looking for good food in Thimphu? Pelbu Suites serves Indian, Bhutanese and multicuisine dining plus cafe pastry in Olakha — table service, lunch for groups, online order.",
  },
  stayOlakha: {
    title: "Stay in Olakha, Thimphu | Quiet hotel base",
    description:
      "Why stay in Olakha when you visit Thimphu: calm nights, easy road links into the city, and hotel facilities (rooms, food, spa) on one property.",
  },
  agents: {
    title: "Travel agents & group stays in Thimphu",
    description:
      "Partner with Pelbu Suites Olakha for Thimphu group stays — agent rates, FOC guide/driver beds, and one-roof F&B for your travellers.",
  },
  gallery: {
    title: "Hotel gallery | Rooms, dining & Olakha",
    description:
      "Photographs and a 3D walk of Pelbu Suites in Olakha, Thimphu — king, twin and suite rooms, restaurant, lobby, the building outside, and the street you arrive on.",
  },
  services: {
    title: "Hotel services & facilities in Thimphu",
    description:
      "Guest services and facilities at Pelbu Suites Olakha, Thimphu — dining, spa, meeting and practical help for your stay.",
  },
  facilities: {
    title: "Hotel facilities & good service in Thimphu",
    description:
      "What to expect at Pelbu Suites Olakha: rooms, dining, spa, steam, meeting space and practical hospitality — good facilities and service for stays in Thimphu, Bhutan.",
  },
} as const;

/**
 * Build Next.js Metadata for a public page with title, description,
 * canonical, robots and social cards.
 */
export function buildPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  ogPublicId?: string | null;
  ogAlt?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const { title, description, path, ogPublicId, ogAlt, robots } = options;
  const branded =
    title.includes(SITE_NAME) || /\|?\s*Pelbu Suites\s*$/i.test(title)
      ? title
      : `${title} | ${SITE_NAME}`;

  const social = shareSocialMeta({
    title: branded,
    description,
    path,
    publicId: ogPublicId,
    alt: ogAlt ?? `${SITE_NAME} · ${SEO_LOCALE}`,
  });

  return {
    // absolute avoids double suffix with root title.template
    title: { absolute: branded },
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    ...social,
  };
}

/** Prefer CMS SEO fields, fall back to catalog defaults. */
export function metadataFromCms(
  cms: {
    seo_title?: string | null;
    meta_description?: string | null;
    canonical_path?: string | null;
    og_public_id?: string | null;
  } | null | undefined,
  defaults: { title: string; description: string; path: string },
): Metadata {
  return buildPageMetadata({
    title: cms?.seo_title?.trim() || defaults.title,
    description: cms?.meta_description?.trim() || defaults.description,
    path: cms?.canonical_path?.trim() || defaults.path,
    ogPublicId: cms?.og_public_id,
  });
}

/** Absolute self-link for sitemap / internal SEO notes. */
export function seoCanonicalUrl(path: string): string {
  return absoluteUrl(path);
}
