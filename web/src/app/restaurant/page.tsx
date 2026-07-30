import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
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
  primary_cta_href: "/menu?outlet=restaurant",
  primary_cta_label: "Order restaurant food",
  secondary_cta_href: "/contact",
  secondary_cta_label: "Ask about a table",
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
          <>
            <Button asChild variant="citrus">
              <a href={copy.primary_cta_href ?? "/menu?outlet=restaurant"}>
                {copy.primary_cta_label ?? "Order restaurant food"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={copy.secondary_cta_href ?? "/contact"}>
                {copy.secondary_cta_label ?? "Ask about a table"}
              </a>
            </Button>
          </>
        }
      >
        <div className="space-y-10">
          <CmsContentSections sections={page?.sections_json} />
          {copy.hours_note ? (
            <p className="rounded-2xl border border-border bg-mint-100/50 px-4 py-3 text-sm text-mint-600">
              {copy.hours_note}
            </p>
          ) : null}
          <section>
            <MenuSections
              byCategory={byCategory}
              orderBaseHref={hasMenu ? "/menu" : undefined}
            />
            {hasMenu ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="citrus">
                  <a href="/menu?outlet=restaurant">Order restaurant food</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/menu">Browse full menu</a>
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
