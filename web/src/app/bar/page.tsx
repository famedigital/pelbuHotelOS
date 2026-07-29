import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage, pickHeroSrc } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";

export const metadata = {
  title: "Bar | Pelbu Suites",
  description: "Weekend bar menu at Pelbu Suites, Thimphu.",
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Bar",
  title: "Weekend pours.",
  body: "A calm bar for guests and locals — weekend specials and classic pours.",
  hours_note: "Weekend evenings; weekday hours at the desk.",
  primary_cta_href: "/dine",
  primary_cta_label: "All dining",
};

export default async function BarPage() {
  const [page, gallery, items] = await Promise.all([
    loadCmsPage("bar"),
    loadCmsGallery("bar"),
    loadMenuByOutlets(["bar"]),
  ]);
  const copy = page ?? FALLBACK;
  const byCategory = groupMenuByCategory(items);

  return (
    <ConversionShell
      heroSrc={pickHeroSrc(gallery)}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Hours</p>
          <p>{copy.hours_note ?? "Ask the desk for bar hours."}</p>
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
          <h2 className="text-sm font-medium text-ink">The pours</h2>
          <div className="mt-4">
            <MenuSections byCategory={byCategory} />
          </div>
        </section>
        <MediaGallery items={gallery} label="Bar" />
      </div>
    </ConversionShell>
  );
}
