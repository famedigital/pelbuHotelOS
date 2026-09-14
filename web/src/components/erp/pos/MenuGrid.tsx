"use client";

import { MenuTile } from "@/components/erp/pos/MenuTile";
import type { MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Props = {
  items: MenuItem[];
  category: string;
  search: string;
  onAdd: (menuItemId: string) => void;
  onEditLine?: (key: string) => void;
  className?: string;
};

export function MenuGrid({
  items,
  category,
  search,
  onAdd,
  className,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (q) {
        const hay = `${item.name} ${item.description ?? ""} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, category, search]);

  if (filtered.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        {search.trim()
          ? `No items match "${search.trim()}".`
          : "No menu items for this outlet."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {filtered.map((item) => (
        <MenuTile
          key={item.id}
          item={item}
          onClick={() => onAdd(item.id)}
        />
      ))}
    </div>
  );
}
