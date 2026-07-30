"use client";

import {
  deleteMenuItem,
  saveMenuItem,
  type MenuAdminState,
} from "@/app/actions/erp-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { MenuItem } from "@/lib/menu";
import { ImageIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

const initial: MenuAdminState = { ok: false };

const OUTLET_LABELS: Record<string, string> = {
  cafe: "Cafe",
  pastry: "Pastry",
  restaurant: "Restaurant",
  bar: "Bar",
};

const PREP_STATION_LABELS: Record<string, string> = {
  kitchen: "Kitchen (hot)",
  bar: "Bar",
  pastry: "Pastry",
  grill: "Grill",
  cold: "Cold / pantry",
};

const NONE_IMAGE = "__none__";

export type MenuItemFormTarget =
  | { mode: "create"; defaultOutlet: string }
  | { mode: "edit"; item: MenuItem }
  | null;

export function MenuItemForm({
  target,
  onOpenChange,
}: {
  target: MenuItemFormTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const open = target !== null;
  const editing = target?.mode === "edit" ? target.item : null;

  const [saveState, saveAction, savePending] = useActionState(
    saveMenuItem,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteMenuItem,
    initial,
  );

  useActionToast(saveState, { successMessage: "Menu item saved" });
  useActionToast(deleteState, { successMessage: "Menu item deleted" });

  const [name, setName] = useState("");
  const [outlet, setOutlet] = useState<string>("cafe");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priceBtn, setPriceBtn] = useState("");
  const [prepStation, setPrepStation] = useState<string>("kitchen");
  const [imagePublicId, setImagePublicId] = useState<string>("");
  const [gstApplicable, setGstApplicable] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      setOutlet(editing.outlet);
      setCategory(editing.category);
      setDescription(editing.description ?? "");
      setPriceBtn(String(editing.price_btn));
      setPrepStation(editing.prep_station ?? "kitchen");
      setImagePublicId(editing.image_public_id ?? "");
      setGstApplicable(editing.gst_applicable);
      setIsAvailable(editing.is_available ?? true);
      setIsPopular(editing.is_popular ?? false);
      setSortOrder(String(editing.sort_order ?? 0));
    } else if (target?.mode === "create") {
      setName("");
      setOutlet(target.defaultOutlet ?? "cafe");
      setCategory("");
      setDescription("");
      setPriceBtn("");
      setPrepStation("kitchen");
      setImagePublicId("");
      setGstApplicable(true);
      setIsAvailable(true);
      setIsPopular(false);
      setSortOrder("0");
    }
  }, [open, editing, target]);

  useEffect(() => {
    if (saveState.ok || deleteState.ok) onOpenChange(false);
  }, [saveState.ok, deleteState.ok, onOpenChange]);

  if (!open) return null;

  const previewSrc = imagePublicId
    ? cloudinaryUrl(imagePublicId, { width: 160, crop: "fill" })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit menu item" : "Add menu item"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update details, photo, availability. Changes apply to POS, public order page, and outlet menus immediately."
              : "Add a new dish or drink. Visible across POS, public site, and KOT routing as soon as it is available."}
          </DialogDescription>
        </DialogHeader>

        {saveState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{saveState.error}</AlertDescription>
          </Alert>
        ) : null}
        {deleteState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{deleteState.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="item_id" value={editing?.id ?? ""} />
          <input type="hidden" name="outlet" value={outlet} />
          <input type="hidden" name="prep_station" value={prepStation} />
          <input type="hidden" name="image_public_id" value={imagePublicId} />
          <input
            type="hidden"
            name="gst_applicable"
            value={gstApplicable ? "1" : "0"}
          />
          <input
            type="hidden"
            name="is_available"
            value={isAvailable ? "1" : "0"}
          />
          <input type="hidden" name="is_popular" value={isPopular ? "1" : "0"} />

          <div className="space-y-1.5">
            <Label htmlFor="mi_name">Item name</Label>
            <Input
              id="mi_name"
              name="name"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="e.g. Ema Datshi, Cappuccino, Druk 1100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mi_outlet">Outlet</Label>
              <Select value={outlet} onValueChange={setOutlet}>
                <SelectTrigger id="mi_outlet" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTLET_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mi_category">Category</Label>
              <Input
                id="mi_category"
                name="category"
                required
                maxLength={40}
                autoComplete="off"
                placeholder="Coffee · Mains · Beer"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="mi_category_suggestions"
              />
              <datalist id="mi_category_suggestions">
                <option value="Coffee" />
                <option value="Tea" />
                <option value="Mains" />
                <option value="Snacks" />
                <option value="Desserts" />
                <option value="Beer" />
                <option value="Spirits" />
              </datalist>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mi_price">Price (Nu)</Label>
              <Input
                id="mi_price"
                name="price_btn"
                type="number"
                required
                min={0}
                step="0.01"
                inputMode="decimal"
                value={priceBtn}
                onChange={(e) => setPriceBtn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mi_prep">Prep station</Label>
              <Select value={prepStation} onValueChange={setPrepStation}>
                <SelectTrigger id="mi_prep" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PREP_STATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mi_description">Description</Label>
            <Textarea
              id="mi_description"
              name="description"
              rows={2}
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — appears under the item on the public menu"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mi_sort">Sort order</Label>
              <Input
                id="mi_sort"
                name="sort_order"
                type="number"
                min={0}
                max={9999}
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Lower shows first inside a category.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Photo</Label>
              <div className="flex items-center gap-2">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary">
                  {previewSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-4 text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="h-9"
                >
                  {imagePublicId ? "Change" : "Choose"}
                </Button>
                {imagePublicId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-muted-foreground"
                    onClick={() => setImagePublicId("")}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <fieldset className="grid gap-2 sm:grid-cols-3">
            <ToggleCheck
              label="Available"
              checked={isAvailable}
              onChange={setIsAvailable}
            />
            <ToggleCheck
              label="GST applies"
              checked={gstApplicable}
              onChange={setGstApplicable}
            />
            <ToggleCheck
              label="Popular"
              checked={isPopular}
              onChange={setIsPopular}
            />
          </fieldset>

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/5"
                disabled={savePending || deletePending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={savePending || deletePending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="citrus"
                disabled={savePending || deletePending}
              >
                {savePending ? "Saving…" : editing ? "Save changes" : "Add item"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {confirmDelete && editing ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-foreground">
              Delete “{editing.name}”? Past orders keep their snapshot, but the
              item leaves every menu immediately.
            </p>
            <div className="mt-3 flex gap-2">
              <form action={deleteAction}>
                <input type="hidden" name="item_id" value={editing.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Yes, delete"}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deletePending}
              >
                Keep item
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>

      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(publicId) => {
          setImagePublicId(publicId);
          setPickerOpen(false);
        }}
        uploadFolder="pelbu/menu"
        title="Choose a dish photo"
        description="Square 1:1 works best on the public menu and POS tile."
      />
    </Dialog>
  );
}

function ToggleCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors ${
        checked
          ? "border-accent/40 bg-accent/10 text-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          checked ? "text-accent" : "text-muted-foreground"
        }`}
      >
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
