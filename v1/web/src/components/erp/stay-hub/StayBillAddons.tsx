"use client";

import {
  loadStayBillAddons,
  postStayExtraMattressAction,
  type StayBillAddons,
} from "@/app/actions/erp-stay-bill-addons";
import { GuestLaundrySlip } from "@/components/laundry/GuestLaundrySlip";
import { PostMinibarChargeForm } from "@/components/erp/PostMinibarChargeForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGuestBtn } from "@/lib/pricing";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AddPanel = "mattress" | "laundry" | "services";

export function StayBillAddons({
  folioId,
  bookingId,
  guestName,
  roomUnitId,
  roomLabel,
  onPosted,
}: {
  folioId: string;
  bookingId: string;
  guestName: string;
  roomUnitId: string | null;
  roomLabel: string | null;
  onPosted?: () => void;
}) {
  const [panel, setPanel] = useState<AddPanel | null>(null);
  const [addons, setAddons] = useState<StayBillAddons | null>(null);
  const [loading, setLoading] = useState(false);

  async function open(next: AddPanel) {
    setPanel((current) => (current === next ? null : next));
    if (addons || loading) return;
    setLoading(true);
    const result = await loadStayBillAddons();
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setAddons(result.data);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <AddButton
          label="Extra mattress"
          open={panel === "mattress"}
          onClick={() => void open("mattress")}
        />
        <AddButton
          label="Laundry"
          open={panel === "laundry"}
          onClick={() => void open("laundry")}
        />
        <AddButton
          label="Other services"
          open={panel === "services"}
          onClick={() => void open("services")}
        />
      </div>
      {panel && loading && !addons ? (
        <p className="text-sm text-muted-foreground">Loading prices…</p>
      ) : null}
      {panel === "mattress" && addons ? (
        <MattressForm
          folioId={folioId}
          bookingId={bookingId}
          rateBtn={addons.extraBedSellable ? addons.extraBedRateBtn : null}
          onPosted={onPosted}
        />
      ) : null}
      {panel === "laundry" && addons ? (
        roomUnitId ? (
          <GuestLaundrySlip
            lockStay
            catalog={addons.laundry}
            emptyHint="Add laundry prices under Rooms → Laundry → Pricing."
            onPosted={onPosted}
            bookings={[
              {
                id: bookingId,
                contactName: guestName || "Guest",
                rooms: [{ id: roomUnitId, label: roomLabel || "Room" }],
              },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Assign the room, then add laundry.
          </p>
        )
      ) : null}
      {panel === "services" && addons ? (
        addons.services.length > 0 ? (
          <PostMinibarChargeForm
            folioId={folioId}
            items={addons.services}
            embedded
            onPosted={onPosted}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No minibar or amenity prices are set for this hotel.
          </p>
        )
      ) : null}
    </div>
  );
}

function AddButton({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={open}
      className="border-[var(--brass-hairline)] bg-white text-[var(--espresso)] hover:bg-[var(--ivory-deep)]"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function MattressForm({
  folioId,
  bookingId,
  rateBtn,
  onPosted,
}: {
  folioId: string;
  bookingId: string;
  rateBtn: number | null;
  onPosted?: () => void;
}) {
  const [state, action, pending] = useActionState(postStayExtraMattressAction, {
    ok: false,
  });
  const onPostedRef = useRef(onPosted);
  onPostedRef.current = onPosted;
  const seen = useRef(0);

  useEffect(() => {
    if (!state.ok || !state.at || seen.current === state.at) return;
    seen.current = state.at;
    if (state.message) toast.success(state.message);
    onPostedRef.current?.();
  }, [state.ok, state.at, state.message]);

  if (rateBtn == null || !(rateBtn > 0)) {
    return (
      <p className="text-sm text-muted-foreground">
        Set the extra mattress rate in hotel settings.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border border-[var(--brass-hairline)] bg-white p-3">
      <input type="hidden" name="folio_id" value={folioId} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <p className="text-sm">
        Extra mattress {formatGuestBtn(rateBtn)} each. Posts on the room bill.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="mattress_qty">Qty</Label>
          <Input
            id="mattress_qty"
            name="qty"
            type="number"
            min={1}
            max={10}
            step={1}
            defaultValue={1}
            className="h-9 w-20"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Posting…" : "Post to room bill"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
