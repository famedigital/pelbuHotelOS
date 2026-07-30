import { MediaGallery } from "@/components/media/MediaGallery";
import { CmsContentSections } from "@/components/site/CmsContentSections";
import { EngineShell } from "@/components/site/EngineShell";
import { MenuSections } from "@/components/site/MenuSections";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
import { groupMenuByCategory, loadMenuByOutlets } from "@/lib/menu-loader";

export const metadata = {
  title: "Bar | Pelbu Suites",
  description: "Weekend bar menu at Pelbu Suites, Thimphu.",
  alternates: { canonical: "/bar" },
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Bar",
  title: "Weekend pours.",
  body: "A calm bar for guests and locals — weekend specials and classic pours.",
  hours_note: "Weekend evenings; weekday hours at the desk.",
  primary_cta_href: "/menu",
  primary_cta_label: "Full menu",
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
    <EngineShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.body}
      actions={
        <>
          <Button asChild variant="citrus">
            <a href={copy.primary_cta_href ?? "/menu"}>
              {copy.primary_cta_label ?? "Full menu"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/contact">Ask the desk</a>
          </Button>
        </>
      }
    >
      <div className="space-y-10">
        <CmsContentSections sections={page?.sections_json} />
        {copy.hours_note ? (
          <p className="rounded-2xl border border-border bg-sky-100/60 px-4 py-3 text-sm text-sky-700">
            {copy.hours_note}
          </p>
        ) : null}
        <section>
          <MenuSections byCategory={byCategory} />
        </section>
        <MediaGallery items={gallery} label="Bar" />
      </div>
    </EngineShell>
  );
}
