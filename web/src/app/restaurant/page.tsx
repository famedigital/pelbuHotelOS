import { OutletPageShell } from "@/components/site/OutletPageShell";
import { BRAND_CLOUDINARY, OUTLET_SHOWCASE_PHOTOS } from "@/lib/brand";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";
import {
  breadcrumbJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const metadata = {
  title: "Restaurant | Pelbu Suites",
  description:
    "Indian, Bhutanese, and multicuisine restaurant at Pelbu Suites, Olakha Thimphu — order for the table, pickup, or taxi delivery.",
  alternates: { canonical: "/restaurant" },
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Restaurant",
  title: "Indian · Bhutanese · Multicuisine",
  body: "Breakfast, lunch, and dinner with TACT — taste, aroma, consistency, and time. Signature plates you will not find on every Thimphu corner.",
  hours_note: "Lunch and dinner; breakfast when posted.",
  primary_cta_href: "/menu?outlet=restaurant",
  primary_cta_label: "Order restaurant food",
  secondary_cta_href: "/contact",
  secondary_cta_label: "Ask about a table",
};

function heroPhotos(
  gallery: Awaited<ReturnType<typeof loadCmsGallery>>,
) {
  const fromCms = gallery
    .filter((item) => item.public_id || item.src)
    .slice(0, 5)
    .map((item) => ({
      publicId: item.public_id,
      src: item.src,
      alt: item.alt || "Pelbu Suites restaurant",
      resourceType: item.resource_type,
      posterPublicId: item.poster_public_id,
    }));

  if (fromCms.length >= 2) return fromCms;

  return OUTLET_SHOWCASE_PHOTOS.restaurant.map((photo) => ({
    publicId: photo.publicId,
    alt: photo.alt,
  }));
}

export default async function RestaurantPage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("restaurant"),
    loadCmsGallery("restaurant"),
    loadMenuByOutlets(["restaurant"]),
  ]);
  const copy = page ?? FALLBACK;
  const byCategory = groupMenuByCategory(items);
  const hasMenu = items.length > 0;
  const photos = heroPhotos(gallery);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Restaurant", path: "/restaurant" },
            ]),
            restaurantJsonLd({
              name: "Pelbu Suites Restaurant",
              path: "/restaurant",
              image: gallery.find((item) => item.src)?.src,
              servesCuisine: ["Bhutanese", "Indian", "Multi-cuisine"],
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
          { name: "Restaurant" },
        ]}
        primaryCta={{
          href: copy.primary_cta_href ?? "/menu?outlet=restaurant",
          label: copy.primary_cta_label ?? "Order restaurant food",
        }}
        secondaryCta={{
          href: copy.secondary_cta_href ?? "/contact",
          label: copy.secondary_cta_label ?? "Ask about a table",
        }}
        heroPhotos={photos}
        sections={page?.sections_json}
        byCategory={byCategory}
        orderBaseHref={hasMenu ? "/menu" : undefined}
        gallery={gallery}
        galleryLabel="Restaurant"
        accent="sky"
        sisters={[
          {
            href: "/cafe",
            title: "Cafe",
            description: "Espresso, breakfast and all-day plates from early morning.",
            publicId: BRAND_CLOUDINARY.cafePastry,
          },
          {
            href: "/menu?outlet=pastry",
            title: "Pastry",
            description: "Croissants, cakes and Bhutanese bakes made each morning.",
            publicId: BRAND_CLOUDINARY.pastryKhabzay,
          },
          {
            href: "/bar",
            title: "Bar",
            description: "Evening pours and calm weekend nights at the hotel bar.",
            publicId: BRAND_CLOUDINARY.barPour,
          },
        ]}
      />
    </>
  );
}
