import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
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

  return (
    <ConversionShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      aside={
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">Hours</p>
          <p className="leading-relaxed text-espresso/80">
            {copy.hours_note ?? "Ask the desk for today’s service times."}
          </p>
          {copy.primary_cta_href && copy.primary_cta_label ? (
            <a
              href={copy.primary_cta_href}
              className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
            >
              {copy.primary_cta_label}
            </a>
          ) : null}
          {copy.secondary_cta_href && copy.secondary_cta_label ? (
            <a
              href={copy.secondary_cta_href}
              className="inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
            >
              {copy.secondary_cta_label}
            </a>
          ) : null}
        </div>
      }
    >
      <div className="space-y-12">
        <MenuSections byCategory={byCategory} />
        <MediaGallery items={gallery} label="Restaurant" />
      </div>
    </ConversionShell>
  );
}
