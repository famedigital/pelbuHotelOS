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
  const hasMenu = items.length > 0;

  return (
    <ConversionShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      aside={
        <div className="space-y-5 text-sm text-muted">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Hours
            </p>
            <p className="leading-relaxed text-espresso/80">
              {copy.hours_note ?? "Ask the desk for today’s service times."}
            </p>
          </div>
          <div className="space-y-2 border-t border-espresso/10 pt-5">
            {copy.primary_cta_href && copy.primary_cta_label ? (
              <a
                href={copy.primary_cta_href}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso transition-opacity hover:opacity-90"
              >
                {copy.primary_cta_label}
              </a>
            ) : null}
            {copy.secondary_cta_href && copy.secondary_cta_label ? (
              <a
                href={copy.secondary_cta_href}
                className="inline-flex min-h-11 w-full items-center justify-center text-sm text-espresso underline-offset-4 hover:underline"
              >
                {copy.secondary_cta_label}
              </a>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-14">
        <section aria-labelledby="menu-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="menu-heading"
              className="text-xs font-semibold tracking-[0.22em] text-gold uppercase"
            >
              The menu
            </h2>
          </div>
          <div className="mt-6">
            <MenuSections byCategory={byCategory} />
          </div>
          {hasMenu ? (
            <a
              href="/order"
              className="mt-8 inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory transition-opacity hover:opacity-90"
            >
              Build your order
            </a>
          ) : null}
        </section>

        <MediaGallery items={gallery} label="Restaurant" />
      </div>
    </ConversionShell>
  );
}
