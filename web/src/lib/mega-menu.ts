import { BRAND_CLOUDINARY } from "@/lib/brand";
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

const ROOM_IMAGE_FALLBACK: Record<string, string> = {
  deluxe: BRAND_CLOUDINARY.roomsDeluxe,
  superior: BRAND_CLOUDINARY.roomsSuperior,
  twin: BRAND_CLOUDINARY.roomsTwin,
};

function roomDescription(room: PublicRoom): string {
  const text = (room.blurb ?? "").trim();
  if (!text) {
    return `${room.name} at Pelbu Suites, Olakha, Thimphu.`;
  }
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trimEnd()}…`;
}

function roomPublicId(room: PublicRoom): string | undefined {
  if (room.imagePublicId) return room.imagePublicId;
  return ROOM_IMAGE_FALLBACK[room.code] ?? BRAND_CLOUDINARY.roomsDeluxe;
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
      heading: "Stay",
      links: [
        ...stayLinks,
        { href: "/book", label: "Book a stay" },
        { href: "/rooms", label: "All rooms" },
        { href: "/rates", label: "Room rates" },
        { href: "/stay/olakha-thimphu", label: "Staying in Olakha" },
      ],
    },
    {
      heading: "Menu",
      links: [
        { href: "/menu", label: "Menu & prices" },
        { href: "/order", label: "Order online" },
        { href: "/restaurant", label: "Restaurant" },
        { href: "/cafe", label: "Cafe" },
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
      heading: "Business",
      links: [
        { href: "/meeting", label: "Meeting room" },
        { href: "/agents", label: "Travel agents" },
        { href: "/agents/login", label: "Agent portal" },
      ],
    },
    {
      heading: "About",
      links: [
        { href: "/contact", label: "About & contact" },
        { href: "/careers", label: "Careers" },
        { href: "/services", label: "Hotel services" },
        { href: "/gallery", label: "Photo gallery" },
        { href: "/faq", label: "FAQ" },
        { href: "/guide", label: "Local guides" },
      ],
    },
  ];
}

/**
 * Builds the five public mega menus. Stay room rows come from sellable
 * `room_types`; everything else is static conversion destinations.
 */
export function buildMegaMenus(rooms: PublicRoom[]): MegaMenu[] {
  return [
    {
      label: "Stay",
      primary: [
        { heading: "Room categories", items: roomLinks(rooms) },
        {
          heading: "Plan your stay",
          items: [
            {
              href: "/book",
              title: "Book a stay",
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
              title: "Room rates",
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
            { href: "/rates", title: "Room rates" },
            { href: "/faq", title: "FAQ" },
            { href: "/services", title: "Hotel services" },
            { href: "/gallery", title: "Photo gallery" },
          ],
        },
        {
          heading: "Around Olakha",
          items: [
            { href: "/stay/olakha-thimphu", title: "Stay in Olakha" },
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
      label: "Menu",
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
            { href: "/book", title: "Book a stay" },
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
      label: "Business",
      primary: [
        {
          heading: "Meet",
          items: [
            {
              href: "/meeting",
              title: "Meeting room",
              description:
                "Conference layouts, catering and delegate rooms in Thimphu.",
              publicId: BRAND_CLOUDINARY.roomsSuperior,
            },
          ],
        },
        {
          heading: "Trade partners",
          items: [
            {
              href: "/agents",
              title: "Travel agents",
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
          heading: "Hotel",
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
              title: "Staying in Olakha",
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
}
