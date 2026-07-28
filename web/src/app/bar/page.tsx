import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { MenuSections } from "@/components/site/MenuSections";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";
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
  secondary_cta_href: "/book",
  secondary_cta_label: "Reserve",
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
              {copy.hours_note ?? "Ask the desk for bar hours."}
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
              The pours
            </h2>
          </div>
          <div className="mt-6">
            <MenuSections byCategory={byCategory} />
          </div>
        </section>

        <MediaGallery items={gallery} label="Bar" />
      </div>
    </ConversionShell>
  );
}
