"use client";

import {
  InventoryDamageForm,
  InventoryReceiveForm,
  InventoryTransferForm,
  type InvItemRow,
  type InvLocationOption,
} from "@/components/erp/InventoryOpsForms";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ItemActionKind = "receive" | "damage" | "transfer";

export function InventoryItemActionSheet({
  kind,
  itemId,
  items,
  locations,
  onClose,
}: {
  kind: ItemActionKind | null;
  itemId: string | undefined;
  items: InvItemRow[];
  locations: InvLocationOption[];
  onClose: () => void;
}) {
  const item = items.find((i) => i.id === itemId);
  const title =
    kind === "receive"
      ? "Receive stock"
      : kind === "damage"
        ? "Record damage"
        : kind === "transfer"
          ? "Transfer stock"
          : "";

  return (
    <Sheet open={kind != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="erp max-h-[90vh] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>
            {title}
            {item ? ` · ${item.sku}` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 pb-6">
          {kind === "receive" ? (
            <InventoryReceiveForm
              items={items}
              locations={locations}
              selectedItemId={itemId}
            />
          ) : null}
          {kind === "damage" ? (
            <InventoryDamageForm
              items={items}
              locations={locations}
              selectedItemId={itemId}
            />
          ) : null}
          {kind === "transfer" ? (
            <InventoryTransferForm
              items={items}
              locations={locations}
              selectedItemId={itemId}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
