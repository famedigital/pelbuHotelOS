import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";

type Props = {
  byCategory: Map<string, MenuItem[]>;
  emptyMessage?: string;
};

export function MenuSections({
  byCategory,
  emptyMessage = "Menu temporarily unavailable.",
}: Props) {
  const entries = [...byCategory.entries()];
  if (entries.length === 0) {
    return <p className="text-sm text-maroon">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-10">
      {entries.map(([category, items]) => (
        <section key={category}>
          <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
            {category}
          </h2>
          <ul className="mt-4 divide-y divide-espresso/10 border-y border-espresso/10">
            {items.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base text-espresso">{item.name}</p>
                  <p className="text-sm text-espresso">
                    {formatBtn(item.price_btn)}
                  </p>
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
