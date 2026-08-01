"use client";

import {
  postDamageCharge,
  type FolioDamageState,
} from "@/app/actions/erp-folio-damage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: FolioDamageState = { ok: false };

export type DamagePickerItem = {
  id: string;
  label: string;
  amountBtn: number | null;
};

export function PostDamageChargeForm({
  folioId,
  items,
}: {
  folioId: string;
  items: DamagePickerItem[];
}) {
  const [state, action, pending] = useActionState(postDamageCharge, initial);
  useActionToast(state, { successMessage: "Damage charge posted" });
  const [selectedId, setSelectedId] = useState<string>("");

  const options = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: item.label,
        hint:
          item.amountBtn != null
            ? formatBtn(item.amountBtn)
            : "Manager price — enter Nu below",
      })),
    [items],
  );

  const selected = items.find((i) => i.id === selectedId);
  const needsOverride = selected != null && selected.amountBtn == null;

  if (items.length === 0) return null;

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Post damage
      </p>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="folio_id" value={folioId} />
      <input type="hidden" name="damage_item_id" value={selectedId} />
      <div className="space-y-1.5">
        <Label>Damage item</Label>
        <Combobox
          options={options}
          value={selectedId}
          onValueChange={setSelectedId}
          placeholder="Select damage…"
          searchPlaceholder="Search catalog…"
        />
      </div>
      {needsOverride || (selected && selected.amountBtn != null) ? (
        <div className="space-y-1.5">
          <Label htmlFor="amount_override">
            {needsOverride ? "Amount (Nu) — required" : "Override amount (optional)"}
          </Label>
          <Input
            id="amount_override"
            name="amount_override"
            type="number"
            min={0}
            step="0.01"
            required={needsOverride}
            placeholder={
              selected?.amountBtn != null
                ? String(selected.amountBtn)
                : undefined
            }
            defaultValue={
              !needsOverride && selected?.amountBtn != null
                ? String(selected.amountBtn)
                : undefined
            }
          />
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !selectedId} className="h-10">
        {pending ? "Posting…" : "Post to folio"}
      </Button>
    </form>
  );
}
