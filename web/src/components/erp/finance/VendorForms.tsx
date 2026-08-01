"use client";

import {
  createVendor,
  type ErpFinanceState,
} from "@/app/actions/erp-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: ErpFinanceState = { ok: false };

export type VendorRow = {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export function VendorForm() {
  const [state, action, pending] = useActionState(createVendor, initial);
  useActionToast(state, { successMessage: "Vendor saved" });

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Add vendor
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vendor_name">Name</Label>
          <Input id="vendor_name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor_tpn">TPN</Label>
          <Input id="vendor_tpn" name="tax_id" placeholder="Tax payer number" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor_phone">Phone</Label>
          <Input id="vendor_phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor_email">Email</Label>
          <Input id="vendor_email" name="email" type="email" />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Saving…" : "Save vendor"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function VendorTable({ vendors }: { vendors: VendorRow[] }) {
  if (vendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No vendors yet — add suppliers with TPN for GST input.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-[560px] w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {["Name", "TPN", "Phone", "Email"].map((h) => (
              <th
                key={h}
                className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id} className="border-t">
              <td className="px-3 py-2.5 font-medium">{v.name}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{v.tax_id ?? "—"}</td>
              <td className="px-3 py-2.5">{v.phone ?? "—"}</td>
              <td className="px-3 py-2.5">{v.email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
