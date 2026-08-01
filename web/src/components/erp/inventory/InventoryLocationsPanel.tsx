"use client";

import { createInventoryLocation, type InvState } from "@/app/actions/erp-inventory";
import type { InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: InvState = { ok: false };

const selectClass =
  "mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm";

export function InventoryLocationsPanel({
  locations,
}: {
  locations: InvLocationOption[];
}) {
  const [state, action, pending] = useActionState(createInventoryLocation, initial);
  useActionToast(state, { successMessage: "Location added" });

  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="loc_code" className="text-xs text-muted-foreground">
            Code
          </Label>
          <Input id="loc_code" name="code" required placeholder="HK-CART" className="font-mono" />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="loc_name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input id="loc_name" name="name" required placeholder="HK amenity cart" />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="loc_dept" className="text-xs text-muted-foreground">
            Department
          </Label>
          <select id="loc_dept" name="department" defaultValue="pantry" className={selectClass}>
            <option value="store">Store</option>
            <option value="pantry">Pantry / HK</option>
            <option value="kitchen">Kitchen</option>
            <option value="fnb">F&amp;B bar</option>
            <option value="room">Room amenities</option>
            <option value="maintenance">Maintenance</option>
            <option value="laundry">Laundry</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-1">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add location"}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[640px] w-full text-sm">
          <caption className="sr-only">Inventory locations</caption>
          <thead className="bg-muted/40">
            <tr>
              {["Code", "Name", "Department"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-muted-foreground">
                  No locations yet — add your first store or pantry.
                </td>
              </tr>
            ) : (
              locations.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2.5 font-mono text-xs">{l.code}</td>
                  <td className="px-3 py-2.5 font-medium">{l.name}</td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">
                    {l.department.replace(/_/g, " ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
