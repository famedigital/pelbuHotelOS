import { OutletPageShell } from "@/components/site/OutletPageShell";
import { BRAND_CLOUDINARY } from "@/lib/brand";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";
import {
  breadcrumbJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const metadata = {
  title: "Bar | Pelbu Suites",
  description:
    "Weekend bar menu at Pelbu Suites, Olakha Thimphu — calm pours for guests and locals.",
  alternates: { canonical: "/bar" },
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Bar",
  title: "Weekend pours.",
  body: "A calm bar for guests and locals — weekend specials and classic pours.",
  hours_note: "Weekend evenings; weekday hours at the desk.",
  primary_cta_href: "/menu?outlet=bar",
  primary_cta_label: "Bar menu",
  secondary_cta_href: "/contact",
  secondary_cta_label: "Ask the desk",
};

const FALLBACK_HERO = [
  {
    publicId: BRAND_CLOUDINARY.barPour,
    alt: "Evening pour at the Pelbu Suites bar",
  },
  {
    publicId: "pelbu/menu/bar-olakha-old-fashioned",
    alt: "Olakha Old Fashioned",
  },
  {
    publicId: "pelbu/menu/bar-himalayan-gt",
    alt: "Himalayan G&T",
  },
  {
    publicId: "pelbu/menu/bar-suja-highball",
    alt: "Suja Highball",
  },
];

function heroPhotos(
  gallery: Awaited<ReturnType<typeof loadCmsGallery>>,
) {
  const fromCms = gallery
    .filter((item) => item.public_id || item.src)
    .slice(0, 5)
    .map((item) => ({
      publicId: item.public_id,
      src: item.src,
      alt: item.alt || "Pelbu Suites bar",
      resourceType: item.resource_type,
      posterPublicId: item.poster_public_id,
    }));

  return fromCms.length >= 2 ? fromCms : FALLBACK_HERO;
}

export default async function BarPage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("bar"),
    loadCmsGallery("bar"),
    loadMenuByOutlets(["bar"]),
  ]);
  const copy = page ?? FALLBACK;
  const byCategory = groupMenuByCategory(items);
  const hasMenu = items.length > 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Bar", path: "/bar" },
            ]),
            restaurantJsonLd({
              name: "Pelbu Suites Bar",
              path: "/bar",
              image: gallery.find((item) => item.src)?.src,
              servesCuisine: ["Bar"],
            }),
          ]),
        }}
      />
      <OutletPageShell
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.body}
        hoursNote={copy.hours_note}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Bar" },
        ]}
        primaryCta={{
          href: copy.primary_cta_href ?? "/menu?outlet=bar",
          label: copy.primary_cta_label ?? "Bar menu",
        }}
        secondaryCta={{
          href: copy.secondary_cta_href ?? "/contact",
          label: copy.secondary_cta_label ?? "Ask the desk",
        }}
        heroPhotos={heroPhotos(gallery)}
        sections={page?.sections_json}
        byCategory={byCategory}
        orderBaseHref={hasMenu ? "/menu" : undefined}
        gallery={gallery}
        galleryLabel="Bar"
        accent="mint"
        sisters={[
          {
            href: "/restaurant",
            title: "Restaurant",
            description: "Dinner before a pour — Indian, Bhutanese and multicuisine.",
            publicId: BRAND_CLOUDINARY.diningRoom,
          },
          {
            href: "/cafe",
            title: "Cafe",
            description: "Coffee and pastry earlier in the day, a floor away.",
            publicId: BRAND_CLOUDINARY.cafePastry,
          },
          {
            href: "/menu",
            title: "Full menu",
            description: "Every outlet in one place — order for pickup or taxi.",
            publicId: BRAND_CLOUDINARY.restaurantPlate,
          },
        ]}
      />
    </>
  );
}
