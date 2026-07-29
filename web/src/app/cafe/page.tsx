import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage, pickHeroSrc } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";

export const metadata = {
  title: "Cafe & Pastry | Pelbu Suites",
  description:
    "Cafe and pastry at Pelbu Suites — opens 6:30 summer / 7:30 winter. Order for taxi delivery in Thimphu.",
};

export const dynamic = "force-dynamic";

export default async function CafePage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("cafe"),
    loadCmsGallery("cafe"),
    loadMenuByOutlets(["cafe", "pastry"]),
  ]);
  const byCategory = groupMenuByCategory(items);
  const hasMenu = items.length > 0;

  return (
    <ConversionShell
      heroSrc={pickHeroSrc(gallery)}
      eyebrow={page?.eyebrow ?? "Cafe & Pastry"}
      title={page?.title ?? "Morning light, warm pastry."}
      body={
        page?.body ??
        "Opens 6:30 AM in summer and 7:30 AM in winter. Breakfast through dinner — order for pickup or taxi delivery across Thimphu."
      }
      aside={
        <div className="space-y-5 text-sm text-muted-foreground">
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">Order</p>
            <p className="leading-relaxed text-ink/80">
              {page?.hours_note ??
                "GST shown clearly on the bill. Taxi fare is paid to the driver separately."}
            </p>
          </div>
          <div className="space-y-2 border-t border-border pt-5">
            <Button asChild variant="default" className="w-full">
              <a href={page?.primary_cta_href ?? "/order"}>
                {page?.primary_cta_label ?? "Order now"}
              </a>
            </Button>
          </div>
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

        <MediaGallery items={gallery} label="Cafe" />
      </div>
    </ConversionShell>
  );
}
