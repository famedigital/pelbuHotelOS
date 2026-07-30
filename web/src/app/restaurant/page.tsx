import { MediaGallery } from "@/components/media/MediaGallery";
import { EngineShell } from "@/components/site/EngineShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
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
    "Indian, Bhutanese, and multicuisine restaurant at Pelbu Suites, Olakha Thimphu.",
  alternates: { canonical: "/restaurant" },
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Restaurant",
  title: "Indian · Bhutanese · Multicuisine",
  body: "Breakfast, lunch, and dinner with TACT — taste, aroma, consistency, and time.",
  hours_note: "Lunch and dinner; breakfast when posted.",
  primary_cta_href: "/contact",
  primary_cta_label: "Ask about a table",
  secondary_cta_href: "/contact",
  secondary_cta_label: "Ask the desk",
};

export default async function RestaurantPage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("restaurant"),
    loadCmsGallery("restaurant"),
    loadMenuByOutlets(["restaurant"]),
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
      <EngineShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.body}
      actions={
        copy.primary_cta_href && copy.primary_cta_label ? (
          <Button asChild>
            <a href={copy.primary_cta_href}>{copy.primary_cta_label}</a>
          </Button>
        ) : null
      }
    >
      <div className="space-y-10">
        {copy.hours_note ? (
          <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {copy.hours_note}
          </p>
        ) : null}
        <section>
          <MenuSections byCategory={byCategory} />
          {hasMenu ? (
            <div className="mt-8">
              <Button asChild variant="outline">
                <a href="/contact">Ask about a table</a>
              </Button>
            </div>
          ) : null}
        </section>
        <MediaGallery items={gallery} label="Restaurant" />
      </div>
      </EngineShell>
    </>
  );
}
