import { MediaGallery } from "@/components/media/MediaGallery";
import { ConversionShell } from "@/components/site/ConversionShell";
import { loadCmsGallery, loadCmsPage } from "@/lib/cms";

export const metadata = {
  title: "Dine | Pelbu Suites",
  description: "Cafe, pastry, restaurant, and bar at Pelbu Suites Thimphu.",
};

export const dynamic = "force-dynamic";

const FALLBACK = {
  eyebrow: "Dine",
  title: "Cafe, restaurant, and bar.",
  body: "Indian, Bhutanese, and multicuisine — pastry and cafe from early morning — weekend bar for evenings.",
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
    body: "Opens early. Coffee, pastry, and breakfast — order for pickup or taxi delivery across Thimphu.",
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    body: "Indian · Bhutanese · Multicuisine. Breakfast, lunch, and dinner served with TACT.",
  },
  {
    href: "/bar",
    title: "Bar",
    body: "Weekend pours and classic cocktails. A calm room for guests and locals.",
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
              {copy.hours_note ?? "Ask the desk for today’s hours."}
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
        <section aria-labelledby="outlets-heading">
          <div className="flex items-center gap-4">
            <h2
              id="outlets-heading"
              className="text-xs font-semibold tracking-[0.22em] text-gold uppercase"
            >
              Three ways to dine
            </h2>
            <span aria-hidden className="h-px flex-1 bg-espresso/10" />
          </div>
          <ul className="mt-6 divide-y divide-espresso/10 border-y border-espresso/10">
            {STREAMS.map((stream) => (
              <li key={stream.href}>
                <a
                  href={stream.href}
                  className="group flex items-center justify-between gap-4 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <div className="min-w-0">
                    <p className="text-lg text-espresso group-hover:text-maroon transition-colors">
                      {stream.title}
                    </p>
                    <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
                      {stream.body}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0 text-gold transition-transform group-hover:translate-x-1"
                  >
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
