"use client";

import {
  receiveInventoryStock,
  recordInventoryDamage,
  transferInventoryStock,
  type InvState,
} from "@/app/actions/erp-inventory";
import { CloudinaryDocField } from "@/components/erp/CloudinaryDocField";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryOriginalUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: InvState = { ok: false };

const selectClass =
  "mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export type InvLocationOption = {
  id: string;
  code: string;
  name: string;
  department: string;
};

export type InvItemRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty_on_hand: number;
  reorder_level: number;
  unit_cost_btn: number;
  default_location_id: string | null;
  location_balances?: { code: string; name: string; qty: number }[];
};

function ActionFlash({ state }: { state: InvState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`erp mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

function ReceiptPhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [intent, setIntent] = useState<"camera" | "file">("camera");

  return (
    <>
      <CloudinaryDocField
        name="photo_url"
        value={value}
        onPick={(pickIntent) => {
          setIntent(pickIntent);
          setPickerOpen(true);
        }}
        onClear={() => onChange("")}
      />
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Receipt photo"
        uploadFolder="pelbu/inventory"
        initialTab="upload"
        uploadIntent={intent}
        acceptVideo={false}
        onSelect={(publicId) => {
          const url = cloudinaryOriginalUrl(publicId) ?? publicId;
          onChange(url);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

export function InventoryReceiveForm({
  items,
  locations,
  selectedItemId,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
  selectedItemId?: string;
}) {
  const [state, action, pending] = useActionState(receiveInventoryStock, initial);
  const defaultItem = items.find((i) => i.id === selectedItemId) ?? items[0];
  const [photoUrl, setPhotoUrl] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(String(defaultItem?.unit_cost_btn ?? 0));
  useActionToast(state, { successMessage: "Stock received" });

  const selected = defaultItem;
  const defaultLoc =
    selected?.default_location_id ?? locations.find((l) => l.code === "STORE")?.id ?? "";

  const amount = useMemo(() => {
    const q = Number(qty);
    const c = Number(unitCost);
    if (!Number.isFinite(q) || !Number.isFinite(c)) return 0;
    return q * c;
  }, [qty, unitCost]);

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Receive stock
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="recv_item" className="text-xs text-muted-foreground">
          Item
        </Label>
        <select
          id="recv_item"
          name="item_id"
          required
          defaultValue={selectedItemId ?? ""}
          className={selectClass}
          onChange={(e) => {
            const picked = items.find((i) => i.id === e.target.value);
            if (picked) setUnitCost(String(picked.unit_cost_btn));
          }}
        >
          <option value="" disabled>
            Select…
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="recv_loc" className="text-xs text-muted-foreground">
          Location
        </Label>
        <select
          id="recv_loc"
          name="location_id"
          required
          defaultValue={defaultLoc}
          className={selectClass}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.department})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="recv_qty" className="text-xs text-muted-foreground">
            Qty
          </Label>
          <Input
            id="recv_qty"
            name="qty"
            type="number"
            step="0.001"
            min="0.001"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recv_cost" className="text-xs text-muted-foreground">
            Unit price (Nu)
          </Label>
          <Input
            id="recv_cost"
            name="unit_cost_btn"
            type="number"
            step="0.01"
            min="0"
            required
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <p className="mt-1.5 text-sm font-medium tabular-nums text-foreground">
            {formatBtn(amount)}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Receipt photo</Label>
        <input type="hidden" name="photo_url" value={photoUrl} />
        <ReceiptPhotoField value={photoUrl} onChange={setPhotoUrl} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="recv_ref" className="text-xs text-muted-foreground">
          Reference
        </Label>
        <Input id="recv_ref" name="reference" placeholder="Invoice #, vendor…" />
      </div>
      <Button type="submit" variant="citrus" disabled={pending} className="h-10 w-full">
        {pending ? "Posting…" : "Post receive"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryDamageForm({
  items,
  locations,
  selectedItemId,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
  selectedItemId?: string;
}) {
  const [state, action, pending] = useActionState(recordInventoryDamage, initial);
  const [photoUrl, setPhotoUrl] = useState("");
  const [replaceMode, setReplaceMode] = useState("later");
  useActionToast(state, { successMessage: "Damage recorded" });

  const defaultLoc = locations.find((l) => l.code === "STORE")?.id ?? locations[0]?.id;

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Record damage
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="dmg_item" className="text-xs text-muted-foreground">
          Item
        </Label>
        <select
          id="dmg_item"
          name="item_id"
          required
          defaultValue={selectedItemId ?? ""}
          className={selectClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dmg_loc" className="text-xs text-muted-foreground">
            Location
          </Label>
          <select
            id="dmg_loc"
            name="location_id"
            required
            defaultValue={defaultLoc}
            className={selectClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dmg_qty" className="text-xs text-muted-foreground">
            Qty damaged
          </Label>
          <Input id="dmg_qty" name="qty" type="number" step="0.001" min="0.001" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dmg_replace" className="text-xs text-muted-foreground">
          Replace
        </Label>
        <select
          id="dmg_replace"
          name="damage_replace_mode"
          value={replaceMode}
          onChange={(e) => setReplaceMode(e.target.value)}
          className={selectClass}
        >
          <option value="now">Replace now (transfer in)</option>
          <option value="later">Replace later</option>
          <option value="purchase">Replace via purchase receive</option>
          <option value="transfer">Transfer from another location</option>
        </select>
      </div>
      {replaceMode === "transfer" || replaceMode === "now" ? (
        <div className="space-y-1.5">
          <Label htmlFor="dmg_replace_loc" className="text-xs text-muted-foreground">
            Replace to location
          </Label>
          <select
            id="dmg_replace_loc"
            name="replace_location_id"
            defaultValue={defaultLoc}
            className={selectClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Damage photo</Label>
        <input type="hidden" name="photo_url" value={photoUrl} />
        <ReceiptPhotoField value={photoUrl} onChange={setPhotoUrl} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dmg_notes" className="text-xs text-muted-foreground">
          Notes
        </Label>
        <Input id="dmg_notes" name="notes" placeholder="Room 203 · broken glass…" />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Saving…" : "Log damage"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryTransferForm({
  items,
  locations,
  selectedItemId,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
  selectedItemId?: string;
}) {
  const [state, action, pending] = useActionState(transferInventoryStock, initial);
  useActionToast(state, { successMessage: "Transfer posted" });

  const storeId = locations.find((l) => l.code === "STORE")?.id ?? locations[0]?.id;
  const pantryId = locations.find((l) => l.code === "PANTRY")?.id ?? locations[1]?.id;

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Transfer between locations
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="xfer_item" className="text-xs text-muted-foreground">
          Item
        </Label>
        <select
          id="xfer_item"
          name="item_id"
          required
          defaultValue={selectedItemId ?? ""}
          className={selectClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name} ({i.qty_on_hand} {i.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="xfer_from" className="text-xs text-muted-foreground">
            From
          </Label>
          <select
            id="xfer_from"
            name="from_location_id"
            required
            defaultValue={storeId}
            className={selectClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="xfer_to" className="text-xs text-muted-foreground">
            To
          </Label>
          <select
            id="xfer_to"
            name="to_location_id"
            required
            defaultValue={pantryId}
            className={selectClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="xfer_qty" className="text-xs text-muted-foreground">
          Qty
        </Label>
        <Input id="xfer_qty" name="qty" type="number" step="0.001" min="0.001" required />
      </div>
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Transferring…" : "Post transfer"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}
