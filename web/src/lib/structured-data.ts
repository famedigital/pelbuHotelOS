import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

type JsonLd = Record<string, unknown>;

export function hotelJsonLd({
  image,
  telephone,
  email,
  address,
}: {
  image?: string | null;
  telephone?: string | null;
  email?: string | null;
  address?: string | null;
} = {}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `${absoluteUrl("/")}#hotel`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    image: image || undefined,
    telephone: telephone || undefined,
    email: email || undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
          addressLocality: "Thimphu",
          addressCountry: "BT",
        }
      : undefined,
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

export function restaurantJsonLd({
  name,
  path,
  image,
  servesCuisine,
}: {
  name: string;
  path: string;
  image?: string | null;
  servesCuisine?: string[];
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${absoluteUrl(path)}#restaurant`,
    name,
    url: absoluteUrl(path),
    image: image || undefined,
    servesCuisine:
      servesCuisine && servesCuisine.length > 0 ? servesCuisine : undefined,
    parentOrganization: { "@id": `${absoluteUrl("/")}#hotel` },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Thimphu",
      addressRegion: "Thimphu",
      addressCountry: "BT",
    },
  });
}

export function hotelRoomJsonLd({
  name,
  image,
  path = "/rooms",
}: {
  name: string;
  image?: string | null;
  path?: string;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    name,
    image: image || undefined,
    url: absoluteUrl(path),
    containedInPlace: { "@id": `${absoluteUrl("/")}#hotel` },
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
    author: {
      "@type": "Organization",
      name: authorName || SITE_NAME,
    },
    publisher: { "@id": `${absoluteUrl("/")}#hotel` },
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
    mainEntity: { "@id": `${absoluteUrl("/")}#hotel` },
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
      "@id": `${absoluteUrl("/")}#hotel`,
      name: SITE_NAME,
      telephone: telephone || undefined,
      email: email || undefined,
      address: address
        ? {
            "@type": "PostalAddress",
            streetAddress: address,
            addressLocality: "Thimphu",
            addressCountry: "BT",
          }
        : undefined,
    }),
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
