"use client";

import {
  postGuestServiceCharge,
  type GuestServiceState,
} from "@/app/actions/erp-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState } from "react";
import type { DeskBookingOption } from "@/components/erp/pos/types";

const initial: GuestServiceState = { ok: false };

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

const fieldClass =
  "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function GuestServiceForm({
  bookings,
  gstRate,
  serviceChargeRate,
  serviceChargeDefaultOn,
}: {
  bookings: DeskBookingOption[];
  gstRate: number;
  serviceChargeRate: number;
  serviceChargeDefaultOn: boolean;
}) {
  const [state, action, pending] = useActionState(postGuestServiceCharge, initial);

  if (state.ok && state.folioId) {
    return (
      <div
        className="erp rounded-lg border bg-card p-5"
        role="status"
        aria-live="polite"
      >
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Posted
        </p>
        <p className="mt-2 text-sm text-foreground">
          Guest service charged to folio{" "}
          <a
            className="font-medium text-accent underline-offset-4 hover:underline"
            href={`/erp/folios/${state.folioId}`}
          >
            {state.folioId.slice(0, 8)}
          </a>
          .
        </p>
        <a
          href="/erp/pos"
          className="mt-4 inline-flex h-11 items-center text-sm text-foreground underline-offset-4 hover:underline"
        >
          Post another
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="erp space-y-5 rounded-lg border bg-card p-5">
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="border-b pb-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Guest service
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Taxi, shop, or other charge to a folio.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking_id">Booking</Label>
        <select
          id="booking_id"
          name="booking_id"
          required
          defaultValue=""
          className={fieldClass}
        >
          <option value="" disabled>
            Select booking
          </option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {(b.contact_name ?? "Guest")} · {b.check_in} → {b.check_out} ·{" "}
              {nightsBetween(b.check_in, b.check_out)} nights
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service_kind">Kind</Label>
          <select
            id="service_kind"
            name="service_kind"
            defaultValue="taxi"
            className={fieldClass}
          >
            <option value="taxi">Taxi</option>
            <option value="shop">Shop</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount_btn">Amount (Nu)</Label>
          <Input
            id="amount_btn"
            type="number"
            name="amount_btn"
            required
            min={1}
            step="0.01"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          type="text"
          name="description"
          required
          placeholder="Airport run / market errand"
        />
      </div>

      <div className="flex h-11 items-center gap-2.5">
        <Checkbox id="gst_applicable" name="gst_applicable" value="1" defaultChecked />
        <Label htmlFor="gst_applicable" className="text-sm text-foreground">
          GST applicable ({Math.round(gstRate * 10000) / 100}%)
        </Label>
      </div>

      <div className="flex h-11 items-center gap-2.5">
        <Checkbox
          id="service_charge_applied"
          name="service_charge_applied"
          value="1"
          defaultChecked={serviceChargeDefaultOn}
        />
        <Label htmlFor="service_charge_applied" className="text-sm text-foreground">
          Add service charge ({Math.round(serviceChargeRate * 10000) / 100}%)
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="service_charge_rate">Service charge %</Label>
        <Input
          id="service_charge_rate"
          type="number"
          name="service_charge_rate"
          min={0}
          max={100}
          step="0.01"
          defaultValue={Math.round(serviceChargeRate * 10000) / 100}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" type="text" name="notes" />
      </div>

      <Button
        type="submit"
        disabled={pending || bookings.length === 0}
        className="h-11 w-full"
      >
        {pending ? "Posting…" : "Post to folio"}
      </Button>
    </form>
  );
}
