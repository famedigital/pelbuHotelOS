import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

type JsonLd = Record<string, unknown>;

const HOTEL_ID = () => `${absoluteUrl("/")}#hotel`;

/** Price offer from published rack only — never invents money. */
function moneyOffer({
  priceBtn,
  path,
  name,
}: {
  priceBtn: number;
  path: string;
  name?: string;
}): JsonLd {
  return compact({
    "@type": "Offer",
    name: name || undefined,
    price: priceBtn,
    priceCurrency: "BTN",
    availability: "https://schema.org/InStock",
    url: absoluteUrl(path),
  });
}

export function hotelJsonLd({
  image,
  telephone,
  email,
  address,
  mapsUrl,
  latitude,
  longitude,
  checkInTime,
  checkOutTime,
  starRating,
  roomCount,
  priceRange,
  sameAs,
  amenities,
  /** Published room “from” prices for makesOffer rich data */
  roomOffers,
}: {
  image?: string | null;
  telephone?: string | null;
  email?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  starRating?: number | null;
  roomCount?: number | null;
  /** e.g. "Nu 4500+" — only from real published rates */
  priceRange?: string | null;
  sameAs?: string[];
  amenities?: string[];
  roomOffers?: Array<{
    name: string;
    path: string;
    priceBtn: number;
    image?: string | null;
  }>;
} = {}): JsonLd {
  const links = (sameAs ?? []).filter(Boolean);
  const amenityList = (amenities ?? []).filter(Boolean);
  const images = [image].filter((v): v is string => Boolean(v));
  const offers = (roomOffers ?? [])
    .filter((o) => o.priceBtn > 0)
    .slice(0, 12)
    .map((o) => moneyOffer({ priceBtn: o.priceBtn, path: o.path, name: o.name }));

  return compact({
    "@context": "https://schema.org",
    "@type": ["Hotel", "LodgingBusiness"],
    "@id": HOTEL_ID(),
    name: SITE_NAME,
    alternateName: "Pelbu Suites Olakha",
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    image: images.length === 1 ? images[0] : images.length ? images : undefined,
    telephone: telephone || undefined,
    email: email || undefined,
    priceRange: priceRange || undefined,
    checkinTime: checkInTime || undefined,
    checkoutTime: checkOutTime || undefined,
    numberOfRooms: roomCount || undefined,
    currenciesAccepted: "BTN",
    paymentAccepted: "Cash, Bank Transfer",
    availableLanguage: ["English", "Dzongkha"],
    starRating:
      starRating != null
        ? {
            "@type": "Rating",
            ratingValue: starRating,
          }
        : undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
          addressLocality: "Olakha",
          addressRegion: "Thimphu",
          addressCountry: "BT",
        }
      : {
          "@type": "PostalAddress",
          addressLocality: "Olakha",
          addressRegion: "Thimphu",
          addressCountry: "BT",
        },
    geo:
      latitude != null && longitude != null
        ? {
            "@type": "GeoCoordinates",
            latitude,
            longitude,
          }
        : undefined,
    hasMap: mapsUrl || undefined,
    sameAs: links.length ? links : undefined,
    areaServed: {
      "@type": "City",
      name: "Thimphu",
      containedInPlace: {
        "@type": "Country",
        name: "Bhutan",
      },
    },
    amenityFeature: amenityList.length
      ? amenityList.map((name) => ({
          "@type": "LocationFeatureSpecification",
          name,
          value: true,
        }))
      : undefined,
    hasMenu: absoluteUrl("/menu"),
    makesOffer: offers.length ? offers : undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/book"),
        inLanguage: "en",
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: {
        "@type": "LodgingReservation",
        name: "Room reservation",
      },
    },
  });
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "en",
    description: SITE_DESCRIPTION,
    publisher: { "@id": HOTEL_ID() },
  };
}

export function faqJsonLd(
  items: Array<{ question: string; answer: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Collection page list — helps Google understand room inventory pages. */
export function itemListJsonLd({
  name,
  path,
  items,
}: {
  name: string;
  path: string;
  items: Array<{ name: string; path: string; image?: string | null }>;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) =>
      compact({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
        image: item.image || undefined,
      }),
    ),
  };
}

export function restaurantJsonLd({
  name,
  path,
  image,
  servesCuisine,
  telephone,
  menuPath = "/menu",
}: {
  name: string;
  path: string;
  image?: string | null;
  servesCuisine?: string[];
  telephone?: string | null;
  menuPath?: string;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${absoluteUrl(path)}#restaurant`,
    name,
    url: absoluteUrl(path),
    image: image || undefined,
    telephone: telephone || undefined,
    servesCuisine:
      servesCuisine && servesCuisine.length > 0 ? servesCuisine : undefined,
    hasMenu: absoluteUrl(menuPath),
    acceptsReservations: true,
    parentOrganization: { "@id": HOTEL_ID() },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Olakha",
      addressRegion: "Thimphu",
      addressCountry: "BT",
    },
  });
}

export function hotelRoomJsonLd({
  name,
  image,
  path = "/rooms",
  priceBtn,
  description,
}: {
  name: string;
  image?: string | null;
  path?: string;
  priceBtn?: number | null;
  description?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    "@id": `${absoluteUrl(path)}#room`,
    name,
    description: description || undefined,
    image: image || undefined,
    url: absoluteUrl(path),
    containedInPlace: { "@id": HOTEL_ID() },
    offers:
      typeof priceBtn === "number" && priceBtn > 0
        ? moneyOffer({ priceBtn, path, name: `${name} from` })
        : undefined,
  });
}

/** Spa / salon / meeting services — service + provider for rich results. */
export function serviceJsonLd({
  name,
  path,
  description,
  serviceType,
  image,
}: {
  name: string;
  path: string;
  description: string;
  serviceType: string;
  image?: string | null;
  telephone?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${absoluteUrl(path)}#service`,
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    image: image || undefined,
    provider: { "@id": HOTEL_ID() },
    areaServed: {
      "@type": "City",
      name: "Thimphu",
    },
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(path),
    },
  });
}

/**
 * Aggregate room-rate offer for /rates — lowPrice only from published BAR.
 */
export function roomRatesOfferJsonLd({
  lowPriceBtn,
  highPriceBtn,
  description,
}: {
  lowPriceBtn: number;
  highPriceBtn?: number | null;
  description?: string;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${SITE_NAME} guest rooms`,
    description:
      description ||
      "Public rack rates for guest rooms at Pelbu Suites, Olakha, Thimphu.",
    brand: { "@type": "Brand", name: SITE_NAME },
    url: absoluteUrl("/rates"),
    offers: compact({
      "@type": "AggregateOffer",
      priceCurrency: "BTN",
      lowPrice: lowPriceBtn,
      highPrice:
        highPriceBtn != null && highPriceBtn > lowPriceBtn
          ? highPriceBtn
          : undefined,
      offerCount: 1,
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/book"),
    }),
  });
}

export function articleJsonLd({
  title,
  description,
  path,
  image,
  publishedAt,
  updatedAt,
  authorName,
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  authorName?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(path),
    image: image || undefined,
    datePublished: publishedAt || undefined,
    dateModified: updatedAt || undefined,
    mainEntityOfPage: absoluteUrl(path),
    author: {
      "@type": "Organization",
      name: authorName || SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      "@id": HOTEL_ID(),
    },
  });
}

export function menuJsonLd({
  name,
  path,
  items,
}: {
  name: string;
  path: string;
  items: Array<{
    name: string;
    description?: string | null;
    priceBtn?: number;
  }>;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Menu",
    name,
    url: absoluteUrl(path),
    hasMenuSection: {
      "@type": "MenuSection",
      name: "Current menu",
      hasMenuItem: items.slice(0, 40).map((item) =>
        compact({
          "@type": "MenuItem",
          name: item.name,
          description: item.description || undefined,
          offers:
            typeof item.priceBtn === "number"
              ? {
                  "@type": "Offer",
                  price: item.priceBtn,
                  priceCurrency: "BTN",
                }
              : undefined,
        }),
      ),
    },
  });
}

export function aboutPageJsonLd({
  description,
  image,
}: {
  description?: string | null;
  image?: string | null;
} = {}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${absoluteUrl("/contact")}#about`,
    name: `About ${SITE_NAME}`,
    description: description || SITE_DESCRIPTION,
    url: absoluteUrl("/contact"),
    image: image || undefined,
    mainEntity: { "@id": HOTEL_ID() },
  });
}

export function contactPageJsonLd({
  telephone,
  email,
  address,
}: {
  telephone?: string | null;
  email?: string | null;
  address?: string | null;
} = {}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${absoluteUrl("/contact")}#contact`,
    name: `Contact ${SITE_NAME}`,
    url: absoluteUrl("/contact"),
    mainEntity: compact({
      "@type": "Hotel",
      "@id": HOTEL_ID(),
      name: SITE_NAME,
      telephone: telephone || undefined,
      email: email || undefined,
      address: address
        ? {
            "@type": "PostalAddress",
            streetAddress: address,
            addressLocality: "Olakha",
            addressRegion: "Thimphu",
            addressCountry: "BT",
          }
        : undefined,
    }),
  });
}

function googleEmploymentType(raw: string): string {
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    full_time: "FULL_TIME",
    fulltime: "FULL_TIME",
    part_time: "PART_TIME",
    parttime: "PART_TIME",
    contract: "CONTRACTOR",
    contractor: "CONTRACTOR",
    temporary: "TEMPORARY",
    intern: "INTERN",
    internship: "INTERN",
  };
  return map[key] ?? "FULL_TIME";
}

/** Google JobPosting rich result — only for real public vacancies. */
export function jobPostingJsonLd({
  id,
  title,
  description,
  employmentType,
  datePosted,
  validThrough,
  department,
}: {
  id: string;
  title: string;
  description: string;
  employmentType: string;
  datePosted?: string | null;
  validThrough?: string | null;
  department?: string | null;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    identifier: {
      "@type": "PropertyValue",
      name: SITE_NAME,
      value: id,
    },
    datePosted: datePosted || undefined,
    validThrough: validThrough || undefined,
    employmentType: googleEmploymentType(employmentType),
    hiringOrganization: {
      "@type": "Organization",
      name: SITE_NAME,
      sameAs: absoluteUrl("/"),
      "@id": HOTEL_ID(),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Olakha",
        addressRegion: "Thimphu",
        addressCountry: "BT",
      },
    },
    industry: department || "Hospitality",
    directApply: true,
    url: absoluteUrl("/careers"),
  });
}

export function serializeJsonLd(value: JsonLd | JsonLd[]): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function compact(value: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}
