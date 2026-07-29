import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage, pickHeroSrc } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";

export const metadata = {
  title: "Restaurant | Pelbu Suites",
  description:
    "Indian, Bhutanese, and multicuisine restaurant at Pelbu Suites, Olakha Thimphu.",
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Restaurant",
  title: "Indian · Bhutanese · Multicuisine",
  body: "Breakfast, lunch, and dinner with TACT — taste, aroma, consistency, and time.",
  hours_note: "Lunch and dinner; breakfast when posted.",
  primary_cta_href: "/order",
  primary_cta_label: "Order delivery",
  secondary_cta_href: "/book",
  secondary_cta_label: "Reserve a table",
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
    <ConversionShell
      heroSrc={pickHeroSrc(gallery)}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Hours</p>
          <p>{copy.hours_note ?? "Ask the desk for today’s service times."}</p>
          {copy.primary_cta_href && copy.primary_cta_label ? (
            <Button asChild className="w-full">
              <a href={copy.primary_cta_href}>{copy.primary_cta_label}</a>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-12">
        <section>
          <h2 className="text-sm font-medium text-ink">The menu</h2>
          <div className="mt-4">
            <MenuSections byCategory={byCategory} />
          </div>
          {hasMenu ? (
            <div className="mt-8">
              <Button asChild>
                <a href="/order">Build your order</a>
              </Button>
            </div>
          ) : null}
        </section>
        <MediaGallery items={gallery} label="Restaurant" />
      </div>
    </ConversionShell>
  );
}
