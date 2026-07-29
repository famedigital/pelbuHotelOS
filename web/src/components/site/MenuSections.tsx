import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";

type Props = {
  byCategory: Map<string, MenuItem[]>;
  emptyMessage?: string;
};

function categoryHeadingId(category: string, index: number): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cat-${slug || index}`;
}

export function MenuSections({
  byCategory,
  emptyMessage = "Menu temporarily unavailable.",
}: Props) {
  const entries = [...byCategory.entries()];
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-10">
      {entries.map(([category, items], index) => {
        const headingId = categoryHeadingId(category, index);
        return (
          <section key={category} aria-labelledby={headingId}>
            <h2 id={headingId} className="text-sm font-medium text-ink">
              {category}
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  {item.image_src ? (
                    <div className="h-16 w-16 shrink-0 overflow-hidden bg-secondary sm:h-20 sm:w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image_src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        width={80}
                        height={80}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[15px] text-ink">{item.name}</p>
                      <p className="shrink-0 text-sm tabular-nums text-ink">
                        {formatBtn(item.price_btn)}
                      </p>
                    </div>
                    {item.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
