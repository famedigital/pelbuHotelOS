"use client";

import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/lib/menu";
import { formatBtn } from "@/lib/pricing";

function monogramColor(seed: string): string {
  // Deterministic brass/ink palette — never purple/cream.
  const palette = ["#1c1612", "#3a3027", "#b8892c", "#c19548", "#7a1f1f"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function firstLetter(name: string): string {
  const t = name.trim();
  if (!t) return "•";
  return t[0]?.toUpperCase() ?? "•";
}

export function MenuTile({
  item,
  onClick,
}: {
  item: MenuItem;
  onClick: () => void;
}) {
  const letter = firstLetter(item.name);
  const bg = monogramColor(item.id || item.name);
  const soldOut = Boolean(item.sold_out);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut}
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card text-left transition-all hover:border-accent/50 hover:shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-55"
      aria-label={
        soldOut
          ? `${item.name}, sold out`
          : item.stock_label
            ? `Add ${item.name}, ${formatBtn(item.price_btn)}, ${item.stock_label}`
            : `Add ${item.name}, ${formatBtn(item.price_btn)}`
      }
      title={
        !soldOut && item.stock_label
          ? item.stock_label
          : !soldOut && item.sell_size
            ? item.sell_size === "pek"
              ? "Single pour (shared bottle stock)"
              : item.sell_size === "bottle"
                ? "Full bottle (shared pour stock)"
                : undefined
            : undefined
      }
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        {item.image_src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_src}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center text-3xl font-semibold text-ivory"
            style={{ backgroundColor: bg }}
            aria-hidden
          >
            {letter}
          </div>
        )}
        {item.is_popular ? (
          <span className="absolute left-2 top-2 rounded-full bg-citrus px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-espresso">
            Popular
          </span>
        ) : null}
        {soldOut ? (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-background/95 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-destructive shadow-sm">
            Sold out
          </span>
        ) : item.stock_mode !== "untracked" &&
          (item.stock_label || item.stock_on_hand != null) ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm">
            {item.stock_label ?? `${item.stock_on_hand} left`}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {item.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatBtn(item.price_btn)}
          </span>
          {item.gst_applicable ? (
            <Badge variant="outline" className="text-[10px]">
              GST
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}
