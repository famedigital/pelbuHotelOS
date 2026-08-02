"use client";

import {
  postMinibarCharge,
  type FolioMinibarState,
} from "@/app/actions/erp-folio-minibar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: FolioMinibarState = { ok: false };

export type MinibarPickerItem = {
  id: string;
  label: string;
  amountBtn: number;
  category: string;
};

export function PostMinibarChargeForm({
  folioId,
  items,
}: {
  folioId: string;
  items: MinibarPickerItem[];
}) {
  const [state, action, pending] = useActionState(postMinibarCharge, initial);
  useActionToast(state, { successMessage: "Minibar / amenity posted" });
  const [selectedId, setSelectedId] = useState<string>("");

  const options = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: item.label,
        hint: `${item.category} · ${formatBtn(item.amountBtn)}`,
      })),
    [items],
  );

  const selected = items.find((i) => i.id === selectedId);

  if (items.length === 0) return null;

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Minibar / amenity
      </p>
      <p className="text-xs text-muted-foreground">
        Quick folio charge — no POS ticket. Catalog from property seed.
      </p>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />
      <input type="hidden" name="minibar_item_id" value={selectedId} />
      <div className="space-y-1.5">
        <Label>Item</Label>
        <Combobox
          options={options}
          value={selectedId}
          onValueChange={setSelectedId}
          placeholder="Select item…"
          searchPlaceholder="Search minibar…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="minibar_qty">Qty</Label>
          <Input
            id="minibar_qty"
            name="qty"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minibar_override">
            Override unit Nu (optional)
          </Label>
          <Input
            id="minibar_override"
            name="amount_override"
            type="number"
            min={0}
            step="0.01"
            placeholder={
              selected ? String(selected.amountBtn) : undefined
            }
            className="h-10"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || !selectedId} className="h-10">
        {pending ? "Posting…" : "Post to folio"}
      </Button>
    </form>
  );
}
