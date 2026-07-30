"use client";

import { toggleMenuItemAvailable } from "@/app/actions/erp-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MenuItem } from "@/lib/menu";
import {
  ImageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { startTransition, useMemo, useState } from "react";
import { MenuItemForm, type MenuItemFormTarget } from "./MenuItemForm";

const OUTLET_TABS = [
  { value: "all", label: "All" },
  { value: "cafe", label: "Cafe" },
  { value: "pastry", label: "Pastry" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
] as const;

const PREP_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  pastry: "Pastry",
  grill: "Grill",
  cold: "Cold",
};

function formatBtn(n: number): string {
  return `${n.toLocaleString("en-BT", { maximumFractionDigits: 2 })} Nu`;
}

export function MenuAdminGrid({ items }: { items: MenuItem[] }) {
  const [outlet, setOutlet] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<MenuItemFormTarget>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (outlet !== "all" && item.outlet !== outlet) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, outlet, search]);

  const counts = useMemo(() => {
    const byOutlet = new Map<string, number>();
    let unavailable = 0;
    for (const item of items) {
      byOutlet.set(item.outlet, (byOutlet.get(item.outlet) ?? 0) + 1);
      if (!item.is_available) unavailable += 1;
    }
    return { byOutlet, total: items.length, unavailable };
  }, [items]);

  function toggle(item: MenuItem, next: boolean) {
    const fd = new FormData();
    fd.set("item_id", item.id);
    fd.set("is_available", next ? "1" : "0");
    startTransition(() => toggleMenuItemAvailable(fd));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {OUTLET_TABS.map((tab) => {
            const count =
              tab.value === "all"
                ? counts.total
                : (counts.byOutlet.get(tab.value) ?? 0);
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setOutlet(tab.value)}
                className={`min-h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                  outlet === tab.value
                    ? "border-foreground/30 bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search name or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="citrus"
            size="sm"
            className="h-9"
            onClick={() =>
              setTarget({
                mode: "create",
                defaultOutlet: outlet === "all" ? "cafe" : outlet,
              })
            }
          >
            <PlusIcon className="size-4" />
            Add item
          </Button>
        </div>
      </div>

      {counts.unavailable > 0 ? (
        <p className="text-xs text-muted-foreground">
          {counts.unavailable} hidden from public + POS · toggle the Available
          chip on a row to bring it back.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            {items.length === 0
              ? "No menu items yet"
              : "No items match this filter"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {items.length === 0
              ? "Add your first dish or drink. It will appear on the public site, POS, and KOT routing immediately."
              : "Try a different outlet or search."}
          </p>
          {items.length === 0 ? (
            <Button
              type="button"
              variant="citrus"
              className="mt-6 h-11"
              onClick={() =>
                setTarget({
                  mode: "create",
                  defaultOutlet: outlet === "all" ? "cafe" : outlet,
                })
              }
            >
              <PlusIcon className="size-4" />
              Add your first item
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Outlet</th>
                <th className="px-3 py-2 font-medium">Prep</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Available</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((item) => (
                <tr key={item.id} className="align-middle">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                        {item.image_public_id ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cloudinaryUrl(item.image_public_id, {
                              width: 72,
                              crop: "fill",
                            }) ?? undefined}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-foreground">
                            {item.name}
                          </p>
                          {item.is_popular ? (
                            <Badge variant="gold" className="text-[9px]">
                              Popular
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.category}
                          {item.gst_applicable ? " · +GST" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">
                    {item.outlet}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {PREP_LABELS[item.prep_station ?? "kitchen"] ?? "Kitchen"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {formatBtn(item.price_btn)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(item, !item.is_available)}
                      aria-pressed={item.is_available}
                      aria-label={`Toggle availability for ${item.name}`}
                      className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                        item.is_available
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.is_available ? "Available" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => setTarget({ mode: "edit", item })}
                    >
                      <PencilIcon className="size-4" />
                      <span className="sr-only">Edit {item.name}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MenuItemForm target={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}
