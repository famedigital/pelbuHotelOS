import { OutletPageShell } from "@/components/site/OutletPageShell";
import { BRAND_CLOUDINARY, OUTLET_SHOWCASE_PHOTOS } from "@/lib/brand";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";
import {
  breadcrumbJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

import { PAGE_SEO, buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  ...PAGE_SEO.cafe,
  path: "/cafe",
});

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Cafe & Pastry",
  title: "Morning light, warm pastry.",
  body: "Breakfast, coffee, and pastry from the live menu — order for pickup or taxi delivery across Thimphu.",
  hours_note: "Summer 06:30 · Winter 07:30",
  primary_cta_href: "/menu?outlet=cafe",
  primary_cta_label: "Order now",
  secondary_cta_href: "/menu",
  secondary_cta_label: "Full menu",
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
      alt: item.alt || "Pelbu Suites cafe",
      resourceType: item.resource_type,
      posterPublicId: item.poster_public_id,
    }));

  if (fromCms.length >= 2) return fromCms;

  return OUTLET_SHOWCASE_PHOTOS.cafe.map((photo) => ({
    publicId: photo.publicId,
    alt: photo.alt,
  }));
}

export default async function CafePage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("cafe"),
    loadCmsGallery("cafe"),
    loadMenuByOutlets(["cafe", "pastry"]),
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
              { name: "Cafe", path: "/cafe" },
            ]),
            restaurantJsonLd({
              name: "Pelbu Suites Cafe",
              path: "/cafe",
              image: gallery.find((item) => item.src)?.src,
              servesCuisine: ["Cafe", "Bakery", "Bhutanese"],
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
          { name: "Cafe" },
        ]}
        primaryCta={{
          href: copy.primary_cta_href ?? "/menu?outlet=cafe",
          label: copy.primary_cta_label ?? "Order now",
        }}
        secondaryCta={{
          href: copy.secondary_cta_href ?? "/menu",
          label: copy.secondary_cta_label ?? "Full menu",
        }}
        heroPhotos={heroPhotos(gallery)}
        sections={page?.sections_json}
        byCategory={byCategory}
        orderBaseHref={hasMenu ? "/menu" : undefined}
        gallery={gallery}
        galleryLabel="Cafe"
        accent="citrus"
        sisters={[
          {
            href: "/restaurant",
            title: "Restaurant",
            description:
              "Indian, Bhutanese and multicuisine cooking for lunch and dinner.",
            publicId: BRAND_CLOUDINARY.diningRoom,
          },
          {
            href: "/menu?outlet=pastry",
            title: "Pastry counter",
            description: "Croissants, cakes and Bhutanese bakes until they run out.",
            publicId: BRAND_CLOUDINARY.pastryKhabzay,
          },
          {
            href: "/bar",
            title: "Bar",
            description: "Evening pours a few steps from the cafe counter.",
            publicId: BRAND_CLOUDINARY.barPour,
          },
        ]}
      />
    </>
  );
}
