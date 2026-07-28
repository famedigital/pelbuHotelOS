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
    return (
      <p className="rounded-sm border border-espresso/10 bg-espresso/[0.02] px-4 py-6 text-sm text-maroon">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {entries.map(([category, items], index) => {
        const headingId = categoryHeadingId(category, index);
        return (
          <section key={category} aria-labelledby={headingId}>
            <div className="flex items-center gap-4">
              <h2
                id={headingId}
                className="text-xs font-semibold tracking-[0.22em] text-gold uppercase"
              >
                {category}
              </h2>
              <span aria-hidden className="h-px flex-1 bg-espresso/10" />
            </div>
            <ul className="mt-5 divide-y divide-espresso/10 border-t border-espresso/10">
              {items.map((item) => (
                <li key={item.id} className="group py-4 transition-colors">
                  <div className="flex gap-4">
                    {item.image_src ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden bg-espresso/5 sm:h-24 sm:w-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_src}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          width={96}
                          height={96}
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-base text-espresso transition-colors group-hover:text-maroon">
                          {item.name}
                        </p>
                        <p className="shrink-0 text-sm font-medium text-espresso tabular-nums">
                          {formatBtn(item.price_btn)}
                        </p>
                      </div>
                      {item.description ? (
                        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
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
