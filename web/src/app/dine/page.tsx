import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { Button } from "@/components/ui/button";
import { loadCmsGallery, loadCmsPage, pickHeroSrc } from "@/lib/cms";

export const metadata = {
  title: "Dine | Pelbu Suites",
  description: "Cafe, pastry, restaurant, and bar at Pelbu Suites Thimphu.",
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Dine",
  title: "Cafe, restaurant, and bar.",
  body: "Indian, Bhutanese, and multicuisine — pastry from early morning — weekend bar for evenings.",
  hours_note: "Cafe 6:30 summer / 7:30 winter. Restaurant and bar hours vary.",
  primary_cta_href: "/restaurant",
  primary_cta_label: "Restaurant",
  secondary_cta_href: "/cafe",
  secondary_cta_label: "Cafe & pastry",
};

const STREAMS = [
  {
    href: "/cafe",
    title: "Cafe & Pastry",
    body: "Opens early. Order for pickup or taxi across Thimphu.",
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    body: "Indian · Bhutanese · Multicuisine — breakfast to dinner.",
  },
  {
    href: "/bar",
    title: "Bar",
    body: "Weekend pours. A calm room for guests and locals.",
  },
] as const;

export default async function DinePage() {
  const [page, gallery] = await Promise.all([
    loadCmsPage("dine"),
    loadCmsGallery("dine"),
  ]);
  const copy = page ?? FALLBACK;

  return (
    <ConversionShell
      heroSrc={pickHeroSrc(gallery)}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      aside={
        <div className="space-y-4">
          <p className="font-medium text-ink">Hours</p>
          <p>{copy.hours_note ?? "Ask the desk for today’s hours."}</p>
          {copy.primary_cta_href && copy.primary_cta_label ? (
            <Button asChild className="w-full">
              <a href={copy.primary_cta_href}>{copy.primary_cta_label}</a>
            </Button>
          ) : null}
          {copy.secondary_cta_href && copy.secondary_cta_label ? (
            <a
              href={copy.secondary_cta_href}
              className="block text-center text-sm underline underline-offset-4"
            >
              {copy.secondary_cta_label}
            </a>
          ) : null}
        </div>
      }
    >
      <div className="space-y-12">
        <section>
          <h2 className="text-sm font-medium text-ink">Three ways to dine</h2>
          <ul className="mt-4 divide-y divide-border">
            {STREAMS.map((stream) => (
              <li key={stream.href}>
                <a
                  href={stream.href}
                  className="group flex items-start justify-between gap-4 py-5"
                >
                  <div>
                    <p className="text-[15px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                      {stream.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stream.body}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <MediaGallery items={gallery} label="Dining" />
      </div>
    </ConversionShell>
  );
}
