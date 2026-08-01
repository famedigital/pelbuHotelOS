"use client";

import {
  advanceLaundryStatus,
  claimLaundryOrder,
  confirmLaundryReceipt,
  type LaundryStaffState,
} from "@/app/actions/staff-laundry";
import { LaundryBagPrepareForm } from "@/components/laundry/LaundryBagPrepareForm";
import { LaundryPhotoUpload } from "@/components/laundry/LaundryPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LAUNDRY_STATUS_LABEL,
  type LaundryBag,
  type LaundryOrder,
  type LaundryStatus,
} from "@/lib/laundry";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import { CameraIcon, CheckIcon, MinusIcon, PlusIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const initial: LaundryStaffState = { ok: false };

const NEXT_STATUS: Partial<Record<LaundryStatus, LaundryStatus>> = {
  received: "washing",
  washing: "drying",
  drying: "ironing",
  ironing: "quality_check",
  quality_check: "ready",
  ready: "delivered",
};

export function LaundryStaffBoard({
  orders,
  bagsByOrder,
  staffId,
}: {
  orders: LaundryOrder[];
  bagsByOrder: Record<string, LaundryBag[]>;
  staffId: string;
}) {
  const groups = useMemo(
    () => ({
      collect: orders.filter((order) => order.status === "requested"),
      processing: orders.filter((order) =>
        ["received", "washing", "drying", "ironing", "quality_check"].includes(
          order.status,
        ),
      ),
      ready: orders.filter((order) =>
        ["ready", "exception"].includes(order.status),
      ),
    }),
    [orders],
  );
  return (
    <div className="space-y-7">
      <WorkGroup title="To collect" count={groups.collect.length}>
        {groups.collect.map((order) => (
          <LaundryTaskCard
            key={order.id}
            order={order}
            bags={bagsByOrder[order.id] ?? []}
            staffId={staffId}
          />
        ))}
      </WorkGroup>
      <WorkGroup title="Processing" count={groups.processing.length}>
        {groups.processing.map((order) => (
          <LaundryTaskCard
            key={order.id}
            order={order}
            bags={bagsByOrder[order.id] ?? []}
            staffId={staffId}
          />
        ))}
      </WorkGroup>
      <WorkGroup title="Ready & exceptions" count={groups.ready.length}>
        {groups.ready.map((order) => (
          <LaundryTaskCard
            key={order.id}
            order={order}
            bags={bagsByOrder[order.id] ?? []}
            staffId={staffId}
          />
        ))}
      </WorkGroup>
    </div>
  );
}

function WorkGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">{title}</h2>
        <Badge variant="outline">{count}</Badge>
      </div>
      {count ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          No laundry in this stage.
        </div>
      )}
    </section>
  );
}

function LaundryTaskCard({
  order,
  bags,
  staffId,
}: {
  order: LaundryOrder;
  bags: LaundryBag[];
  staffId: string;
}) {
  const [expanded, setExpanded] = useState(order.status === "requested");
  const mine = order.assigned_staff_id === staffId;
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-20 w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-lg font-semibold">Room {order.room_label_snapshot}</p>
          <p className="text-sm text-muted-foreground">
            {order.guest_name} · {order.source.replace("_", " ")}
            {bags.length ? ` · ${bags.length} bag${bags.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="text-right">
          <Badge
            variant={order.status === "exception" ? "destructive" : "outline"}
          >
            {LAUNDRY_STATUS_LABEL[order.status]}
          </Badge>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </button>
      {expanded ? (
        <div className="space-y-4 border-t p-4">
          {order.intake_photo_public_ids.length ? (
            <div className="flex gap-2 overflow-x-auto">
              {order.intake_photo_public_ids.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={cloudinaryUrl(id, {
                    width: 240,
                    height: 240,
                    crop: "fill",
                  }) ?? undefined}
                  alt="Laundry intake"
                  className="size-24 shrink-0 rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}
          {order.requested_notes ? (
            <p className="rounded-xl bg-secondary/60 p-3 text-sm">
              {order.requested_notes}
            </p>
          ) : null}
          {!order.assigned_staff_id ? (
            <form action={claimLaundryOrder}>
              <input type="hidden" name="order_id" value={order.id} />
              <Button type="submit" variant="outline" className="min-h-11 w-full">
                Claim this laundry
              </Button>
            </form>
          ) : null}
          {order.status === "requested" ? (
            <ReceiptForm order={order} disabled={!mine && !!order.assigned_staff_id} />
          ) : (
            <StatusForm order={order} />
          )}
          {bags.length ? (
            <Button asChild variant="citrus" className="min-h-11 w-full">
              <Link href={`/staff/laundry/orders/${order.id}/labels`}>
                <PrinterIcon className="size-4" />
                Print bag QR
              </Link>
            </Button>
          ) : null}
          {order.status !== "delivered" && order.status !== "cancelled" ? (
            <details className="rounded-xl border px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Advanced: split across bags
              </summary>
              <div className="mt-3">
                <LaundryBagPrepareForm
                  orderId={order.id}
                  items={order.laundry_order_items}
                  existingBags={bags}
                  mode="staff"
                />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ReceiptForm({
  order,
  disabled,
}: {
  order: LaundryOrder;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(confirmLaundryReceipt, initial);
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(
      order.laundry_order_items.map((item) => [
        item.id,
        item.confirmed_qty ?? item.requested_qty,
      ]),
    ),
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={order.id} />
      <input
        type="hidden"
        name="counts"
        value={JSON.stringify(
          Object.entries(counts).map(([itemId, qty]) => ({ itemId, qty })),
        )}
      />
      <div className="space-y-2">
        <Label>Confirm garments received</Label>
        {order.laundry_order_items.map((item) => (
          <div
            key={item.id}
            className="flex min-h-14 items-center justify-between rounded-xl border px-3"
          >
            <span className="text-sm font-medium">{item.name_snapshot}</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10"
                onClick={() =>
                  setCounts((current) => ({
                    ...current,
                    [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
                  }))
                }
              >
                <MinusIcon className="size-4" />
              </Button>
              <span className="w-8 text-center font-semibold">
                {counts[item.id] ?? 0}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10"
                onClick={() =>
                  setCounts((current) => ({
                    ...current,
                    [item.id]: Math.min(200, (current[item.id] ?? 0) + 1),
                  }))
                }
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`condition-${order.id}`}>Condition / stain notes</Label>
        <Textarea
          id={`condition-${order.id}`}
          name="condition_notes"
          maxLength={500}
          placeholder="Existing stain, delicate fabric, missing button…"
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
      <Button
        type="submit"
        variant="citrus"
        className="min-h-12 w-full"
        disabled={pending || disabled}
      >
        <CheckIcon className="size-4" />
        {pending ? "Confirming…" : "Confirm count & charge folio"}
      </Button>
    </form>
  );
}

function StatusForm({ order }: { order: LaundryOrder }) {
  const [state, action, pending] = useActionState(advanceLaundryStatus, initial);
  const [photos, setPhotos] = useState<string[]>(
    order.completion_photo_public_ids,
  );
  const [clientEventId] = useState(
    () => `${order.id}-${crypto.randomUUID()}`,
  );
  const next = NEXT_STATUS[order.status] ?? null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={order.id} />
      <input
        type="hidden"
        name="photo_public_ids"
        value={JSON.stringify(photos)}
      />
      <input
        type="hidden"
        name="client_event_id"
        value={clientEventId}
      />
      {order.total_btn != null ? (
        <p className="text-sm font-semibold tabular-nums">
          Folio charged {formatBtn(order.total_btn)}
        </p>
      ) : null}
      {["quality_check", "ready", "exception"].includes(order.status) ? (
        <LaundryPhotoUpload
          value={photos}
          onChange={setPhotos}
          context={{ orderId: order.id }}
          label={
            order.status === "ready"
              ? "Add delivery photo"
              : "Add condition photo"
          }
        />
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`status-notes-${order.id}`}>Update notes</Label>
        <Input
          id={`status-notes-${order.id}`}
          name="notes"
          maxLength={500}
          placeholder="Optional handover or exception note"
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
        {next ? (
          <Button
            type="submit"
            name="next_status"
            value={next}
            className="min-h-12"
            disabled={pending}
          >
            {next === "delivered"
              ? "Confirm delivered"
              : `Start ${LAUNDRY_STATUS_LABEL[next]}`}
          </Button>
        ) : null}
        {order.status !== "exception" ? (
          <Button
            type="submit"
            name="next_status"
            value="exception"
            variant="destructive"
            className="min-h-12"
            disabled={pending}
          >
            Report issue
          </Button>
        ) : (
          <Button
            type="submit"
            name="next_status"
            value="received"
            className="min-h-12"
            disabled={pending}
          >
            Resume
          </Button>
        )}
      </div>
      {photos.length ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CameraIcon className="size-3.5" /> {photos.length} photo
          {photos.length === 1 ? "" : "s"} attached
        </p>
      ) : null}
    </form>
  );
}
