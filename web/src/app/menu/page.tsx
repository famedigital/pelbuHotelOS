import { MenuOrderBoard } from "@/components/menu/MenuOrderBoard";
import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { loadCmsPage } from "@/lib/cms";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import {
  breadcrumbJsonLd,
  menuJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const metadata = {
  title: "Menu & order | Pelbu Suites",
  description:
    "Browse the live cafe, pastry, restaurant, and bar menu at Pelbu Suites, Olakha Thimphu — add dishes and order for pickup or taxi delivery on one page.",
  alternates: { canonical: "/menu" },
};

export const dynamic = "force-dynamic";

const OUTLET_FILTERS = ["cafe", "pastry", "restaurant", "bar"] as const;

type OutletFilter = (typeof OUTLET_FILTERS)[number];

function parseOutlet(value?: string): OutletFilter | undefined {
  return OUTLET_FILTERS.find((outlet) => outlet === value);
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; menu?: string }>;
}) {
  const params = await searchParams;
  const initialOutlet = parseOutlet(params.outlet ?? params.menu);
  const [page, items] = await Promise.all([
    loadCmsPage("dine"),
    loadMenuByOutlets([...OUTLET_FILTERS]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Menu", path: "/menu" },
            ]),
            restaurantJsonLd({
              name: "Pelbu Suites Dining",
              path: "/menu",
              servesCuisine: ["Bhutanese", "Indian", "Multi-cuisine", "Cafe"],
            }),
            menuJsonLd({
              name: "Pelbu Suites menu",
              path: "/menu",
              items: items.map((item) => ({
                name: item.name,
                description: item.description,
                priceBtn: item.price_btn,
              })),
            }),
          ]),
        }}
      />
      <PublicSiteHeader variant="solid" />
      <main className="min-h-[70dvh] bg-background pb-28 lg:pb-10">
        <div className="mx-auto w-full max-w-[1760px] px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="flex items-center gap-3 py-3 md:py-4">
            <h1 className="shrink-0 font-display text-lg text-foreground md:text-xl">
              Menu
            </h1>
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              Cafe, pastry, restaurant and bar — add dishes and order for pickup
              or Thimphu taxi delivery.
            </p>
            {page?.hours_note ? (
              <p className="hidden shrink-0 rounded-full bg-mint-100/60 px-3 py-1 text-xs text-mint-600 xl:block">
                {page.hours_note}
              </p>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
              Menu is temporarily unavailable. Contact the desk or try again
              shortly.
            </p>
          ) : (
            <MenuOrderBoard items={items} initialOutlet={initialOutlet} />
          )}
        </div>
      </main>
    </>
  );
}
