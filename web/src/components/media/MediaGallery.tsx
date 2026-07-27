import type { CmsMediaItem } from "@/lib/cms";

type Props = {
  items: CmsMediaItem[];
  label?: string;
};

/** Presentational gallery — URLs come from CMS/Cloudinary loaders. */
export function MediaGallery({ items, label = "Gallery" }: Props) {
  const visible = items.filter((item) => item.src);
  if (visible.length === 0) return null;

  return (
    <section aria-label={label} className="space-y-4">
      <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
        {label}
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {visible.map((item) => (
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
