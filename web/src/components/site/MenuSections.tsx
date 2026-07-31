import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  byCategory: Map<string, MenuItem[]>;
  emptyMessage?: string;
  orderBaseHref?: string;
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
  orderBaseHref,
}: Props) {
  const entries = [...byCategory.entries()];
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-12">
      {entries.map(([category, items], index) => {
        const headingId = categoryHeadingId(category, index);
        return (
          <section key={category} aria-labelledby={headingId}>
            <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-3">
              <h2
                id={headingId}
                className="font-display text-xl text-foreground md:text-2xl"
              >
                {category}
              </h2>
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {items.length} {items.length === 1 ? "dish" : "dishes"}
              </p>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {items.map((item) => {
                const href = orderBaseHref
                  ? `${orderBaseHref}?outlet=${item.outlet}#item-${item.id}`
                  : null;
                const hasImage = Boolean(
                  item.image_public_id || item.image_src,
                );
                const card = (
                  <article
                    className={cn(
                      "media-card group flex min-h-36 overflow-hidden rounded-2xl border border-border bg-card transition-shadow",
                      href && "hover:border-sky-200 hover:shadow-md",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] font-semibold leading-snug text-foreground group-hover:text-sky-700">
                          {item.name}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-sky-700">
                          {formatBtn(item.price_btn)}
                        </p>
                      </div>
                      {item.description ? (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                        {item.is_popular ? (
                          <Badge variant="citrus">Popular</Badge>
                        ) : null}
                        {item.sold_out ? (
                          <Badge variant="secondary">Sold out</Badge>
                        ) : null}
                        {href ? (
                          <span className="ml-auto text-xs font-medium text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
                            Add to order →
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {hasImage ? (
                      <div className="relative w-28 shrink-0 overflow-hidden bg-secondary sm:w-36">
                        <CloudinaryImage
                          publicId={item.image_public_id}
                          src={item.image_src}
                          alt=""
                          fill
                          sizes="144px"
                          imgClassName="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                        />
                      </div>
                    ) : null}
                  </article>
                );
                return (
                  <li key={item.id}>
                    {href ? (
                      <a href={href} className="block">
                        {card}
                      </a>
                    ) : (
                      card
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
