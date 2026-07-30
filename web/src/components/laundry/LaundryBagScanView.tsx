"use client";

import {
  advanceLaundryBagStatus,
  recordLaundryBagScan,
  type LaundryBagState,
} from "@/app/actions/laundry-bags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LAUNDRY_BAG_STATUS_LABEL,
  LAUNDRY_STATUS_LABEL,
  type LaundryBag,
} from "@/lib/laundry";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

const initial: LaundryBagState = { ok: false };

export function LaundryBagScanView({
  bag,
  siblings,
  order,
  events,
  rawToken,
}: {
  bag: LaundryBag;
  siblings: LaundryBag[];
  order: {
    id: string;
    guest_name: string;
    room_label_snapshot: string;
    status: string;
    assigned_staff_id: string | null;
    requested_notes: string | null;
    condition_notes: string | null;
    intake_photo_public_ids: string[];
    folio_id: string | null;
    subtotal_btn: number | null;
    service_charge_btn: number | null;
    gst_btn: number | null;
    total_btn: number | null;
    billed_at: string | null;
    laundry_order_items: {
      id: string;
      name_snapshot: string;
      confirmed_qty: number | null;
      requested_qty: number;
    }[];
  };
  events: {
    id: string;
    event_type: string;
    notes: string | null;
    created_at: string;
  }[];
  rawToken: string;
}) {
  const [scanState, setScanState] = useState<"pending" | "ok" | "error">(
    "pending",
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [clientEventId] = useState(() => `${bag.id}-scan-${crypto.randomUUID()}`);

  useEffect(() => {
    let cancelled = false;
    void recordLaundryBagScan(bag.id, rawToken, clientEventId).then((result) => {
      if (cancelled) return;
      if (result.ok) setScanState("ok");
      else {
        setScanState("error");
        setScanError(result.error ?? "Could not record scan.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bag.id, clientEventId, rawToken]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Bag scan
            </p>
            <h1 className="mt-1 font-display text-2xl">
              Room {order.room_label_snapshot}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.guest_name}
            </p>
          </div>
          <Badge variant="outline">
            {LAUNDRY_BAG_STATUS_LABEL[bag.status]}
          </Badge>
        </div>
        <p className="mt-3 font-mono text-sm font-semibold">{bag.public_code}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bag {bag.bag_seq} of {siblings.length} · {bag.garment_count} pieces
        </p>
        {scanState === "error" ? (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        ) : null}
        {scanState === "ok" ? (
          <p className="mt-3 text-xs text-muted-foreground">Scan recorded.</p>
        ) : null}
      </section>

      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-xl">This bag</h2>
        <ul className="mt-3 space-y-2">
          {bag.laundry_bag_items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
            >
              <span>{item.name_snapshot ?? "Garment"}</span>
              <span className="font-semibold tabular-nums">{item.qty}</span>
            </li>
          ))}
        </ul>
      </section>

      {siblings.length > 1 ? (
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-xl">Sibling bags</h2>
          <ul className="mt-3 space-y-2">
            {siblings.map((sibling) => (
              <li
                key={sibling.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  sibling.id === bag.id ? "border-accent bg-accent/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Bag {sibling.bag_seq} · {sibling.public_code}
                  </span>
                  <Badge variant="outline">
                    {LAUNDRY_BAG_STATUS_LABEL[sibling.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sibling.laundry_bag_items
                    .map(
                      (item) =>
                        `${item.qty}× ${item.name_snapshot ?? "item"}`,
                    )
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-xl">Order & billing</h2>
        <p className="mt-2 text-sm">
          Status{" "}
          <Badge variant="outline">
            {LAUNDRY_STATUS_LABEL[
              order.status as keyof typeof LAUNDRY_STATUS_LABEL
            ] ?? order.status}
          </Badge>
        </p>
        {order.requested_notes ? (
          <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm">
            {order.requested_notes}
          </p>
        ) : null}
        {order.condition_notes ? (
          <p className="mt-2 rounded-xl border p-3 text-sm">
            Condition: {order.condition_notes}
          </p>
        ) : null}
        {order.intake_photo_public_ids.length ? (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {order.intake_photo_public_ids.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={id}
                src={
                  cloudinaryUrl(id, {
                    width: 240,
                    height: 240,
                    crop: "fill",
                  }) ?? undefined
                }
                alt="Laundry intake"
                className="size-24 shrink-0 rounded-xl object-cover"
              />
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-1 text-sm">
          {order.subtotal_btn != null ? (
            <p>Subtotal {formatBtn(order.subtotal_btn)}</p>
          ) : null}
          {order.service_charge_btn != null && order.service_charge_btn > 0 ? (
            <p>Service charge {formatBtn(order.service_charge_btn)}</p>
          ) : null}
          {order.gst_btn != null && order.gst_btn > 0 ? (
            <p>GST {formatBtn(order.gst_btn)}</p>
          ) : null}
          <p className="text-base font-semibold tabular-nums">
            {order.total_btn == null
              ? "Awaiting count / folio charge"
              : `Total ${formatBtn(order.total_btn)}`}
          </p>
          {order.folio_id ? (
            <Button asChild variant="outline" className="mt-2 min-h-11 w-full">
              <Link href={`/erp/folios/${order.folio_id}/receipt`}>
                Open folio receipt
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <BagCheckpointForm bagId={bag.id} />

      {events.length ? (
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-lg">Chain of custody</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border px-3 py-2">
                <p className="font-medium">{event.event_type.replace(/_/g, " ")}</p>
                {event.notes ? (
                  <p className="text-xs text-muted-foreground">{event.notes}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button asChild variant="outline" className="min-h-11 w-full">
        <Link href="/staff/laundry">Back to laundry board</Link>
      </Button>
    </div>
  );
}

function BagCheckpointForm({ bagId }: { bagId: string }) {
  const [state, action, pending] = useActionState(
    advanceLaundryBagStatus,
    initial,
  );
  const [clientEventId] = useState(() => `${bagId}-${crypto.randomUUID()}`);
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <h2 className="font-display text-xl">Bag checkpoint</h2>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="bag_id" value={bagId} />
        <input type="hidden" name="client_event_id" value={clientEventId} />
        <div className="space-y-1.5">
          <Label htmlFor="bag-notes">Notes</Label>
          <Input
            id="bag-notes"
            name="notes"
            maxLength={300}
            placeholder="Optional handover note"
          />
        </div>
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.message ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="submit"
            name="next_status"
            value="in_process"
            className="min-h-12"
            disabled={pending}
          >
            In process
          </Button>
          <Button
            type="submit"
            name="next_status"
            value="ready"
            className="min-h-12"
            disabled={pending}
          >
            Bag ready
          </Button>
          <Button
            type="submit"
            name="next_status"
            value="delivered"
            variant="citrus"
            className="min-h-12"
            disabled={pending}
          >
            Delivered
          </Button>
          <Button
            type="submit"
            name="next_status"
            value="open"
            variant="outline"
            className="min-h-12"
            disabled={pending}
          >
            Reset open
          </Button>
        </div>
      </form>
    </section>
  );
}
