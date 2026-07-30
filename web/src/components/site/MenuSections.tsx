import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";
import { CloudinaryImage } from "@/components/media/CloudinaryImage";
import { Badge } from "@/components/ui/badge";

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
            <h2
              id={headingId}
              className="text-lg font-semibold text-foreground"
            >
              {category}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {items.map((item) => {
                const href = orderBaseHref
                  ? `${orderBaseHref}?outlet=${item.outlet}#item-${item.id}`
                  : null;
                const card = (
                  <article className="media-card flex min-h-36 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-sky-700">
                          {formatBtn(item.price_btn)}
                        </p>
                      </div>
                      {item.description ? (
                        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      {item.is_popular ? (
                        <div className="mt-auto pt-3">
                          <Badge variant="citrus">Popular choice</Badge>
                        </div>
                      ) : null}
                    </div>
                    {(item.image_public_id || item.image_src) && (
                      <div className="relative w-28 shrink-0 overflow-hidden sm:w-32">
                        <CloudinaryImage
                          publicId={item.image_public_id}
                          src={item.image_src}
                          alt=""
                          fill
                          sizes="128px"
                          imgClassName="object-cover"
                        />
                      </div>
                    )}
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
