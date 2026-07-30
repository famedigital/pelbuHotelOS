import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";

export const metadata = {
  title: "Cafe & Pastry | Pelbu Suites",
  description:
    "Cafe and pastry at Pelbu Suites — order from the live menu for pickup or taxi delivery in Thimphu.",
  alternates: { canonical: "/cafe" },
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
    <EngineShell
      eyebrow={page?.eyebrow ?? "Cafe & Pastry"}
      title={page?.title ?? "Morning light, warm pastry."}
      description={
        page?.body ??
        "Breakfast, coffee, and pastry from the live menu — order for pickup or taxi delivery across Thimphu."
      }
      actions={
        <>
          <Button asChild variant="citrus">
            <a href={page?.primary_cta_href ?? "/menu?outlet=cafe"}>
              {page?.primary_cta_label ?? "Order now"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/menu">Full menu</a>
          </Button>
        </>
      }
    >
      <div className="space-y-10">
        <CmsContentSections sections={page?.sections_json} />
        {page?.hours_note ? (
          <p className="rounded-2xl border border-border bg-mint-100/50 px-4 py-3 text-sm text-mint-600">
            {page.hours_note}
          </p>
        ) : null}
        <section>
          <MenuSections
            byCategory={byCategory}
            orderBaseHref={hasMenu ? "/menu" : undefined}
          />
          {hasMenu ? (
            <div className="mt-8">
              <Button asChild variant="citrus">
                <a href="/menu?outlet=cafe">Build your order</a>
              </Button>
            </div>
          ) : null}
        </section>
        <MediaGallery items={gallery} label="Cafe" />
      </div>
    </EngineShell>
  );
}
