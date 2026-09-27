"use client";

import { MenuTile, type MenuLineExtras } from "@/components/erp/pos/MenuTile";
import { EmptyState } from "@/components/ui/empty-state";
import type { MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Props = {
  items: MenuItem[];
  category: string;
  search: string;
  onAdd: (menuItemId: string) => void;
  onConfigure: (menuItemId: string, extras: MenuLineExtras) => void;
  onEditLine?: (key: string) => void;
  className?: string;
};

export function MenuGrid({
  items,
  category,
  search,
  onAdd,
  onConfigure,
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
      <EmptyState
        className="min-h-[240px] py-10"
        title={
          search.trim()
            ? `No items match “${search.trim()}”`
            : "No menu items for this outlet"
        }
      />
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 @min-[1100px]/pos:grid-cols-3 @min-[1400px]/pos:grid-cols-4 @min-[1680px]/pos:grid-cols-5",
        className,
      )}
    >
      {filtered.map((item) => (
        <MenuTile
          key={item.id}
          item={item}
          onAdd={() => onAdd(item.id)}
          onConfigure={(extras) => onConfigure(item.id, extras)}
        />
      ))}
    </div>
  );
}
