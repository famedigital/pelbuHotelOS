import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
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

  return (
    <ConversionShell
      eyebrow={page?.eyebrow ?? "Cafe & Pastry"}
      title={page?.title ?? "Morning light, warm pastry."}
      body={
        page?.body ??
        "Opens 6:30 AM in summer and 7:30 AM in winter. Breakfast through dinner — order for pickup or taxi delivery across Thimphu."
      }
      aside={
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">Order</p>
          <p className="leading-relaxed text-espresso/80">
            {page?.hours_note ??
              "GST shown clearly on the bill. Taxi fare is paid to the driver separately."}
          </p>
          <a
            href={page?.primary_cta_href ?? "/order"}
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
          >
            {page?.primary_cta_label ?? "Order now"}
          </a>
        </div>
      }
    >
      <div className="space-y-12">
        <MenuSections byCategory={byCategory} />
        {items.length > 0 ? (
          <a
            href="/order"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Build your order
          </a>
        ) : null}
        <MediaGallery items={gallery} label="Cafe" />
      </div>
    </ConversionShell>
  );
}
