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
    body: "Morning open, taxi delivery across Thimphu.",
  },
  {
    href: "/restaurant",
    title: "Restaurant",
    body: "Indian · Bhutanese · Multicuisine — TACT service.",
  },
  {
    href: "/bar",
    title: "Bar",
    body: "Weekend pours and classics.",
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
        <div className="space-y-4 text-sm text-muted">
          <p className="text-xs tracking-[0.2em] text-gold uppercase">Hours</p>
          <p className="leading-relaxed text-espresso/80">
            {copy.hours_note ?? "Ask the desk for today’s hours."}
          </p>
          {copy.primary_cta_href && copy.primary_cta_label ? (
            <a
              href={copy.primary_cta_href}
              className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
            >
              {copy.primary_cta_label}
            </a>
          ) : null}
          {copy.secondary_cta_href && copy.secondary_cta_label ? (
            <a
              href={copy.secondary_cta_href}
              className="inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
            >
              {copy.secondary_cta_label}
            </a>
          ) : null}
        </div>
      }
    >
      <div className="space-y-12">
        <ul className="divide-y divide-espresso/10 border-y border-espresso/10">
          {STREAMS.map((stream) => (
            <li key={stream.href} className="py-5">
              <a
                href={stream.href}
                className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <p className="text-lg text-espresso group-hover:text-maroon">
                  {stream.title}
                </p>
                <p className="mt-1 text-sm text-muted">{stream.body}</p>
              </a>
            </li>
          ))}
        </ul>
        <MediaGallery items={gallery} label="Dining" />
      </div>
    </ConversionShell>
  );
}
