"use client";

import {
  createVendor,
  createVendorBill,
  payVendorBill,
  type ErpFinanceState,
} from "@/app/actions/erp-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
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

export type BillRow = {
  id: string;
  bill_no: string | null;
  bill_date: string;
  description: string;
  total_btn: number;
  status: string;
  vendor_name: string | null;
};

function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
}

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

export function VendorBillForm({ vendors }: { vendors: VendorRow[] }) {
  const [state, action, pending] = useActionState(createVendorBill, initial);
  useActionToast(state, { successMessage: "Vendor bill recorded" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Record vendor bill (AP)
      </h2>
      <p className="text-xs text-muted-foreground">
        Bills stay in AP until you pay from the hotel bank — unlike cash expenses.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bill_date">Bill date</Label>
          <Input
            id="bill_date"
            name="bill_date"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor_id">Vendor</Label>
          <select id="vendor_id" name="vendor_id" className={selectClass()}>
            <option value="">— optional —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill_no">Bill no</Label>
          <Input id="bill_no" name="bill_no" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bill_description">Description</Label>
          <Input id="bill_description" name="description" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill_amount">Net amount (Nu)</Label>
          <Input
            id="bill_amount"
            name="amount_btn"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill_gst">GST (Nu)</Label>
          <Input
            id="bill_gst"
            name="gst_btn"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Saving…" : "Save bill to AP"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-foreground">{state.message}</p> : null}
    </form>
  );
}

export function VendorBillsTable({ bills }: { bills: BillRow[] }) {
  if (bills.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No vendor bills yet. Record supplier invoices here; pay when cash leaves
        the hotel account.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-[640px] w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {["Date", "Vendor", "Description", "Total", "Status", ""].map((h) => (
              <th
                key={h || "act"}
                className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <BillPayRow key={b.id} bill={b} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillPayRow({ bill }: { bill: BillRow }) {
  const [state, action, pending] = useActionState(payVendorBill, initial);
  useActionToast(state, { successMessage: "Bill paid" });
  const open = bill.status === "open" || bill.status === "partial";

  return (
    <tr className="border-t">
      <td className="px-3 py-2 tabular-nums">{bill.bill_date}</td>
      <td className="px-3 py-2">{bill.vendor_name ?? "—"}</td>
      <td className="px-3 py-2">
        {bill.description}
        {bill.bill_no ? (
          <span className="block text-[11px] text-muted-foreground">
            #{bill.bill_no}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 tabular-nums">{formatBtn(bill.total_btn)}</td>
      <td className="px-3 py-2 capitalize">{bill.status}</td>
      <td className="px-3 py-2">
        {open ? (
          <form action={action}>
            <input type="hidden" name="bill_id" value={bill.id} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending}
              className="h-8 text-xs"
            >
              {pending ? "Paying…" : "Pay from bank"}
            </Button>
          </form>
        ) : null}
        {state.error ? (
          <p className="text-[11px] text-destructive">{state.error}</p>
        ) : null}
      </td>
    </tr>
  );
}

export function VendorTable({ vendors }: { vendors: VendorRow[] }) {
  if (vendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No vendors yet — add suppliers with TPN for GST input.
      </p>
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
              <td className="px-3 py-2 font-medium">{v.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{v.tax_id ?? "—"}</td>
              <td className="px-3 py-2">{v.phone ?? "—"}</td>
              <td className="px-3 py-2">{v.email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
