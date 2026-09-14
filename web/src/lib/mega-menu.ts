import { BRAND_CLOUDINARY, resolveRoomImagePublicId } from "@/lib/brand";
import type { PublicRoom } from "@/lib/public-content";

export type MegaLink = {
  href: string;
  title: string;
  /**
   * Written as a real sentence naming the entity and place (Pelbu Suites,
   * Olakha, Thimphu, Bhutan) so the nav carries crawlable, quotable context for
   * search and answer engines rather than bare labels. Only the wide left
   * column renders it.
   */
  description?: string;
  publicId?: string;
};

export type MegaGroup = {
  heading: string;
  items: MegaLink[];
};

/** Sidebar promo. `publicId` turns the card into a media tile. */
export type MegaCard = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  publicId?: string;
};

export type MegaMenu = {
  label: string;
  /** Wide column: thumbnail + title + description rows. */
  primary: MegaGroup[];
  /** Narrow column: label-only shortcuts. */
  secondary: MegaGroup[];
  /** Right rail: a media promo above a plain enquiry card. */
  feature: MegaCard;
  contact: MegaCard;
};

function roomDescription(room: PublicRoom): string {
  const text = (room.blurb ?? "").trim();
  if (!text) {
    return `${room.name} at Pelbu Suites, Olakha, Thimphu.`;
  }
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trimEnd()}…`;
}

function roomPublicId(room: PublicRoom): string {
  return resolveRoomImagePublicId({
    code: room.code,
    name: room.name,
    imagePublicId: room.imagePublicId,
  });
}

/** Deluxe leads the room list; the remaining categories keep DB order. */
function roomLinks(rooms: PublicRoom[]): MegaLink[] {
  const links = rooms.map((room) => ({
    href: `/rooms/${room.slug}`,
    title: room.name,
    description: roomDescription(room),
    publicId: roomPublicId(room),
  }));

  const deluxe = links.find((link) => link.href === "/rooms/deluxe");
  return deluxe ? [deluxe, ...links.filter((link) => link !== deluxe)] : links;
}

export type FooterColumn = {
  heading: string;
  links: { href: string; label: string }[];
};

/**
 * Flat link columns for the site footer. Stay rooms come from the same
 * sellable `room_types` list the mega menu uses; the other columns mirror the
 * five top-level menus so header and footer stay in lockstep.
 */
export function buildFooterColumns(rooms: PublicRoom[]): FooterColumn[] {
  const stayLinks = roomLinks(rooms).map((link) => ({
    href: link.href,
    label: link.title,
  }));

  return [
    {
      heading: "Rooms",
      links: [
        ...stayLinks,
        { href: "/book", label: "Book now" },
        { href: "/rooms", label: "All rooms" },
        { href: "/rates", label: "Rate card" },
        { href: "/stay/hotels-in-thimphu", label: "Hotels in Thimphu" },
        { href: "/stay/olakha-thimphu", label: "Olakha neighbourhood" },
        { href: "/stay/facilities-service", label: "Facilities & service" },
      ],
    },
    {
      heading: "Dine",
      links: [
        { href: "/menu", label: "Full menu & prices" },
        { href: "/order", label: "Order online" },
        { href: "/restaurant", label: "Restaurant" },
        { href: "/cafe", label: "Cafe" },
        { href: "/stay/food-in-thimphu", label: "Food in Thimphu" },
        { href: "/menu?outlet=pastry", label: "Pastry" },
        { href: "/bar", label: "Bar" },
      ],
    },
    {
      heading: "Wellness",
      links: [
        { href: "/spa", label: "Spa & steam" },
        { href: "/salon", label: "Salon" },
        { href: "/contact", label: "Book a treatment" },
      ],
    },
    {
      heading: "Meetings",
      links: [
        { href: "/meeting", label: "Conference room" },
        { href: "/agents", label: "Travel trade" },
        { href: "/agents/login", label: "Agent portal" },
      ],
    },
    {
      heading: "About",
      links: [
        { href: "/contact", label: "Contact & hours" },
        { href: "/careers", label: "Careers" },
        { href: "/services", label: "Hotel services" },
        { href: "/gallery", label: "Photo gallery" },
        { href: "/faq", label: "FAQ" },
        { href: "/guide", label: "Local guides" },
      ],
    },
  ];
}

/** CMS / ERP image overrides for mega menu thumbs and promo tiles. */
export type MegaMenuMediaOverrides = {
  /** Right-rail feature image by top-level menu label (Rooms, Dine, …). */
  features: Record<string, string>;
  /** Primary-row image keyed `"MenuLabel::/href"`. */
  items: Record<string, string>;
};

export const EMPTY_MEGA_MENU_MEDIA: MegaMenuMediaOverrides = {
  features: {},
  items: {},
};

export function megaItemKey(menuLabel: string, href: string): string {
  return `${menuLabel}::${href}`;
}

export function parseMegaMenuMedia(raw: unknown): MegaMenuMediaOverrides {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const featuresIn =
    r.features && typeof r.features === "object"
      ? (r.features as Record<string, unknown>)
      : {};
  const itemsIn =
    r.items && typeof r.items === "object"
      ? (r.items as Record<string, unknown>)
      : {};

  const features: Record<string, string> = {};
  for (const [k, v] of Object.entries(featuresIn)) {
    if (typeof v === "string" && v.trim()) features[k] = v.trim();
  }
  const items: Record<string, string> = {};
  for (const [k, v] of Object.entries(itemsIn)) {
    if (typeof v === "string" && v.trim()) items[k] = v.trim();
  }
  return { features, items };
}

export function megaMenuMediaToJson(
  media: MegaMenuMediaOverrides,
): Record<string, unknown> {
  return {
    features: { ...media.features },
    items: { ...media.items },
  };
}

export function applyMegaMenuMedia(
  menus: MegaMenu[],
  media: MegaMenuMediaOverrides,
): MegaMenu[] {
  /** Legacy CMS keys before public labels were renamed. */
  const legacyLabel = (label: string): string | null => {
    if (label === "Dine") return "Menu";
    if (label === "Rooms") return "Stay";
    if (label === "Meetings") return "Business";
    return null;
  };

  return menus.map((menu) => {
    const featureId =
      media.features[menu.label] ??
      (legacyLabel(menu.label)
        ? media.features[legacyLabel(menu.label)!]
        : undefined);
    return {
      ...menu,
      primary: menu.primary.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const override =
            media.items[megaItemKey(menu.label, item.href)] ??
            (legacyLabel(menu.label)
              ? media.items[megaItemKey(legacyLabel(menu.label)!, item.href)]
              : undefined);
          return override ? { ...item, publicId: override } : item;
        }),
      })),
      feature: featureId
        ? { ...menu.feature, publicId: featureId }
        : menu.feature,
    };
  });
}

/** Flat list of every image the ERP can change (for editors). */
export type MegaMediaSlot = {
  menuLabel: string;
  kind: "feature" | "primary";
  href: string;
  title: string;
  description?: string;
  publicId: string | null;
  /** Form / state key */
  key: string;
  /** Suggested Cloudinary folder for new uploads. */
  uploadFolder: string;
};

function folderForMenu(label: string): string {
  switch (label) {
    case "Rooms":
    case "Stay":
      return "pelbu/rooms";
    case "Dine":
    case "Menu":
      return "pelbu/restaurant";
    case "Wellness":
      return "pelbu/spa";
    case "Meetings":
    case "Business":
      return "pelbu/hotel";
    case "About":
      return "pelbu/hotel";
    default:
      return "pelbu/brand";
  }
}

export function collectMegaMediaSlots(menus: MegaMenu[]): MegaMediaSlot[] {
  const slots: MegaMediaSlot[] = [];
  for (const menu of menus) {
    const folder = folderForMenu(menu.label);
    slots.push({
      menuLabel: menu.label,
      kind: "feature",
      href: menu.feature.href,
      title: menu.feature.title,
      description: menu.feature.description,
      publicId: menu.feature.publicId ?? null,
      key: `feature::${menu.label}`,
      uploadFolder: folder,
    });
    for (const group of menu.primary) {
      for (const item of group.items) {
        slots.push({
          menuLabel: menu.label,
          kind: "primary",
          href: item.href,
          title: item.title,
          description: item.description,
          publicId: item.publicId ?? null,
          key: megaItemKey(menu.label, item.href),
          uploadFolder: folder,
        });
      }
    }
  }
  return slots;
}

/**
 * Builds the five public mega menus. Stay room rows come from sellable
 * `room_types`; everything else is static conversion destinations.
 * Pass CMS overrides to swap thumbnails without a deploy.
 */
export function buildMegaMenus(
  rooms: PublicRoom[],
  media: MegaMenuMediaOverrides = EMPTY_MEGA_MENU_MEDIA,
): MegaMenu[] {
  const menus: MegaMenu[] = [
    {
      label: "Rooms",
      primary: [
        { heading: "Categories", items: roomLinks(rooms) },
        {
          heading: "Reserve",
          items: [
            {
              href: "/book",
              title: "Book now",
              description:
                "Live availability, room rates and meal plans at Pelbu Suites, Thimphu.",
              publicId: BRAND_CLOUDINARY.roomsSuiteView,
            },
            {
              href: "/rooms",
              title: "Compare all rooms",
              description:
                "Deluxe, superior and twin rooms side by side before you book.",
              publicId: BRAND_CLOUDINARY.roomsLiving,
            },
            {
              href: "/rates",
              title: "Rate card",
              description:
                "Public rack rates by season at Pelbu Suites, Olakha — book direct for BAR.",
              publicId: BRAND_CLOUDINARY.roomsSuiteAlt,
            },
          ],
        },
      ],
      secondary: [
        {
          heading: "Good to know",
          items: [
            { href: "/faq", title: "FAQ" },
            { href: "/services", title: "Hotel services" },
            { href: "/gallery", title: "Photo gallery" },
          ],
        },
        {
          heading: "Around Olakha",
          items: [
            { href: "/stay/olakha-thimphu", title: "Olakha neighbourhood" },
            { href: "/guide", title: "Local guides" },
            { href: "/contact", title: "Directions" },
          ],
        },
      ],
      feature: {
        title: "Book direct, pay less",
        description:
          "Best available rate, no channel fee, confirmed by the Olakha front desk.",
        href: "/book",
        ctaLabel: "Check rates",
        publicId: BRAND_CLOUDINARY.roomsSuiteView,
      },
      contact: {
        title: "Need a room tonight?",
        description: "The desk answers late — call before you drive over.",
        href: "/contact",
        ctaLabel: "Contact the desk",
      },
    },

    {
      label: "Dine",
      primary: [
        {
          heading: "Outlets",
          items: [
            {
              href: "/restaurant",
              title: "Restaurant",
              description:
                "Indian, Bhutanese and multicuisine cooking served in Olakha, Thimphu.",
              publicId: BRAND_CLOUDINARY.diningRoom,
            },
            {
              href: "/cafe",
              title: "Cafe",
              description:
                "Espresso, breakfast and all-day plates from early morning onwards.",
              publicId: BRAND_CLOUDINARY.cafePastry,
            },
            {
              href: "/menu?outlet=pastry",
              title: "Pastry",
              description:
                "Croissants, cakes and Bhutanese bakes made in-house each morning.",
              publicId: BRAND_CLOUDINARY.pastryKhabzay,
            },
            {
              href: "/bar",
              title: "Bar",
              description:
                "Evening pours and calm weekend nights at the hotel bar.",
              publicId: BRAND_CLOUDINARY.barPour,
            },
          ],
        },
        {
          heading: "Order",
          items: [
            {
              href: "/menu",
              title: "Menu & prices",
              description:
                "Browse every dish and price across all four Pelbu outlets.",
              publicId: BRAND_CLOUDINARY.restaurantPlate,
            },
          ],
        },
      ],
      secondary: [
        {
          heading: "Dining",
          items: [
            { href: "/order", title: "Order online" },
            { href: "/menu?outlet=cafe", title: "Cafe menu" },
            { href: "/menu?outlet=restaurant", title: "Restaurant menu" },
          ],
        },
        {
          heading: "At the hotel",
          items: [
            { href: "/rooms", title: "Rooms" },
            { href: "/spa", title: "Spa" },
            { href: "/meeting", title: "Meetings" },
          ],
        },
      ],
      feature: {
        title: "Delivered across Thimphu",
        description:
          "Order from the online kitchen and we send it out by taxi, hot.",
        href: "/order",
        ctaLabel: "Start an order",
        publicId: BRAND_CLOUDINARY.restaurantPlate,
      },
      contact: {
        title: "Table for tonight?",
        description: "Large groups and private dining, arranged by phone.",
        href: "/contact",
        ctaLabel: "Call the restaurant",
      },
    },

    {
      label: "Wellness",
      primary: [
        {
          heading: "Treatments",
          items: [
            {
              href: "/spa",
              title: "Spa & steam",
              description:
                "Massage, steam and recovery treatments after a day on Bhutan's roads.",
              publicId: BRAND_CLOUDINARY.spaSteam,
            },
            {
              href: "/salon",
              title: "Salon",
              description:
                "Hair, nail and personal-care appointments for guests and walk-ins.",
              publicId: BRAND_CLOUDINARY.spaJacuzzi,
            },
          ],
        },
        {
          heading: "Make an evening of it",
          items: [
            {
              href: "/cafe",
              title: "Cafe afterwards",
              description:
                "Suja, coffee and something warm a floor away from the treatment room.",
              publicId: BRAND_CLOUDINARY.cafePastry,
            },
          ],
        },
      ],
      secondary: [
        {
          heading: "Plan",
          items: [
            { href: "/book", title: "Book now" },
            { href: "/rooms", title: "Rooms" },
            { href: "/faq", title: "FAQ" },
          ],
        },
        {
          heading: "More",
          items: [
            { href: "/services", title: "Hotel services" },
            { href: "/gallery", title: "Photo gallery" },
          ],
        },
      ],
      feature: {
        title: "Stay and unwind",
        description:
          "Pair a room night with steam and a massage without leaving the building.",
        href: "/book",
        ctaLabel: "Check rooms",
        publicId: BRAND_CLOUDINARY.spaJacuzzi,
      },
      contact: {
        title: "Book a treatment",
        description: "Ask the desk for today's therapist availability.",
        href: "/contact",
        ctaLabel: "Ask the desk",
      },
    },

    {
      label: "Meetings",
      primary: [
        {
          heading: "Venue",
          items: [
            {
              href: "/meeting",
              title: "Conference room",
              description:
                "Conference layouts, catering and delegate rooms in Thimphu.",
              publicId: BRAND_CLOUDINARY.roomsSuperior,
            },
          ],
        },
        {
          heading: "Travel trade",
          items: [
            {
              href: "/agents",
              title: "Become a partner",
              description:
                "Contracted rates, credit terms and allotments for Bhutan tour operators.",
              publicId: BRAND_CLOUDINARY.roomsSuiteAlt,
            },
            {
              href: "/agents/login",
              title: "Agent portal",
              description:
                "Sign in to hold rooms, issue vouchers and pull your statement.",
              publicId: BRAND_CLOUDINARY.galleryExt,
            },
          ],
        },
      ],
      secondary: [
        {
          heading: "For planners",
          items: [
            { href: "/book", title: "Book room nights" },
            { href: "/rooms", title: "Room categories" },
            { href: "/rates", title: "Public rate card" },
            { href: "/menu", title: "Catering menu" },
          ],
        },
        {
          heading: "Also useful",
          items: [
            { href: "/services", title: "Hotel services" },
            { href: "/careers", title: "Careers" },
            { href: "/gallery", title: "Photo gallery" },
            { href: "/faq", title: "FAQ" },
          ],
        },
      ],
      feature: {
        title: "Corporate rates in Thimphu",
        description:
          "Recurring delegate travel, billed monthly against one account.",
        href: "/contact",
        ctaLabel: "Talk to us",
        publicId: BRAND_CLOUDINARY.roomsSuperior,
      },
      contact: {
        title: "Already an agent?",
        description: "Your credit balance and vouchers live in the portal.",
        href: "/agents/login",
        ctaLabel: "Agent login",
      },
    },

    {
      label: "About",
      primary: [
        {
          heading: "Pelbu Suites",
          items: [
            {
              href: "/contact",
              title: "About & contact",
              description:
                "The Olakha story, front-desk hours, phone number and directions.",
              publicId: BRAND_CLOUDINARY.galleryExt,
            },
            {
              href: "/services",
              title: "Hotel services",
              description:
                "Rooms, dining, spa, meetings and everything the desk arranges.",
              publicId: BRAND_CLOUDINARY.diningRoom,
            },
            {
              href: "/careers",
              title: "Careers",
              description:
                "Open roles at Pelbu Suites — express interest and we will call if there is a fit.",
              publicId: BRAND_CLOUDINARY.galleryExt,
            },
          ],
        },
        {
          heading: "Read before you arrive",
          items: [
            {
              href: "/stay/olakha-thimphu",
              title: "Olakha neighbourhood",
              description:
                "Why Olakha works as a base for getting around Thimphu, Bhutan.",
              publicId: BRAND_CLOUDINARY.roomsSuiteAlt,
            },
            {
              href: "/guide",
              title: "Local guides",
              description:
                "Practical Thimphu notes on money, altitude, taxis and timing.",
              publicId: BRAND_CLOUDINARY.roomsLiving,
            },
          ],
        },
      ],
      secondary: [
        {
          heading: "Guest info",
          items: [
            { href: "/faq", title: "FAQ" },
            { href: "/gallery", title: "Photo gallery" },
            { href: "/rooms", title: "Rooms & rates" },
          ],
        },
        {
          heading: "Outlets",
          items: [
            { href: "/restaurant", title: "Restaurant" },
            { href: "/cafe", title: "Cafe" },
            { href: "/spa", title: "Spa" },
          ],
        },
      ],
      feature: {
        title: "Olakha, Thimphu, Bhutan",
        description:
          "Minutes from the expressway, walking distance to the shops you need.",
        href: "/contact",
        ctaLabel: "Get directions",
        publicId: BRAND_CLOUDINARY.galleryExt,
      },
      contact: {
        title: "Questions before booking?",
        description: "Ask about airport pickup, early check-in or GST invoices.",
        href: "/contact",
        ctaLabel: "Contact us",
      },
    },
  ];

  return applyMegaMenuMedia(menus, media);
}
