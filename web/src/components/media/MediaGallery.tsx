import type { CmsMediaItem } from "@/lib/cms";

type Props = {
  items: CmsMediaItem[];
  label?: string;
};

/** Presentational gallery — URLs come from CMS/Cloudinary loaders. */
export function MediaGallery({ items, label = "Gallery" }: Props) {
  const visible = items.filter((item) => item.src);
  if (visible.length === 0) return null;

  // Prefer gallery assets for the lead — skip thumbs/logos stretched to 16:9.
  const leadIndex = visible.findIndex((item) => item.kind === "gallery");
  const showLead = leadIndex >= 0 && visible.length >= 3;
  const lead = showLead ? visible[leadIndex] : null;
  const gridItems = showLead
    ? visible.filter((_, i) => i !== leadIndex)
    : visible;

  return (
    <section aria-label={label} className="space-y-5">
      <div className="flex items-center gap-4">
        <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          {label}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-espresso/10" />
      </div>

      {lead?.src ? (
        <div className="overflow-hidden bg-espresso/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead.src}
            alt={lead.alt || ""}
            className="aspect-[16/9] w-full object-cover"
            loading="eager"
            width={960}
            height={540}
          />
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {gridItems.map((item) => (
          <li key={item.id} className="overflow-hidden bg-espresso/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src!}
              alt={item.alt || ""}
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
              width={480}
              height={360}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
