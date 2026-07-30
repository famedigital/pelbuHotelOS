"use client";

import {
  assignLaundryOrder,
  createDeskLaundryOrder,
  reopenLaundryCorrection,
  saveLaundryCatalogItem,
  type ErpLaundryState,
} from "@/app/actions/erp-laundry";
import { LaundryBagPrepareForm } from "@/components/laundry/LaundryBagPrepareForm";
import { LaundryLiveRefresh } from "@/components/laundry/LaundryLiveRefresh";
import { LaundryPhotoUpload } from "@/components/laundry/LaundryPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LAUNDRY_STATUS_LABEL,
  type LaundryBag,
  type LaundryCatalogItem,
  type LaundryOrder,
} from "@/lib/laundry";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatBtn } from "@/lib/pricing";
import { MinusIcon, PlusIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

const initial: ErpLaundryState = { ok: false };

export type LaundryBookingOption = {
  id: string;
  contactName: string;
  rooms: { id: string; label: string }[];
  guests: string[];
};

type StaffOption = { id: string; name: string };

export function LaundryDesk({
  catalog,
  orders,
  bagsByOrder,
  bookings,
  staff,
}: {
  catalog: LaundryCatalogItem[];
  orders: LaundryOrder[];
  bagsByOrder: Record<string, LaundryBag[]>;
  bookings: LaundryBookingOption[];
  staff: StaffOption[];
}) {
  return (
    <Tabs defaultValue="board" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="board">Live board</TabsTrigger>
          <TabsTrigger value="intake">New intake</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <LaundryLiveRefresh />
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/laundry/qr">Print room QR</Link>
          </Button>
        </div>
      </div>
      <TabsContent value="board">
        <DeskBoard orders={orders} bagsByOrder={bagsByOrder} staff={staff} />
      </TabsContent>
      <TabsContent value="intake">
        <ReceptionIntake catalog={catalog} bookings={bookings} />
      </TabsContent>
      <TabsContent value="pricing">
        <CatalogManager catalog={catalog} />
      </TabsContent>
    </Tabs>
  );
}

function DeskBoard({
  orders,
  bagsByOrder,
  staff,
}: {
  orders: LaundryOrder[];
  bagsByOrder: Record<string, LaundryBag[]>;
  staff: StaffOption[];
}) {
  if (!orders.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No laundry orders yet.
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {orders.map((order) => {
        const bags = bagsByOrder[order.id] ?? [];
        return (
        <article key={order.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">
                Room {order.room_label_snapshot}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.guest_name} · {order.source.replace("_", " ")}
                {bags.length
                  ? ` · ${bags.length} bag${bags.length === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <Badge
              variant={order.status === "exception" ? "destructive" : "outline"}
            >
              {LAUNDRY_STATUS_LABEL[order.status]}
            </Badge>
          </div>
          <p className="mt-3 text-sm">
            {order.laundry_order_items
              .map(
                (item) =>
                  `${item.confirmed_qty ?? item.requested_qty}× ${item.name_snapshot}`,
              )
              .join(", ")}
          </p>
          {bags.length ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {bags.map((bag) => (
                <li key={bag.id}>
                  Bag {bag.bag_seq} · {bag.public_code} · {bag.garment_count} pcs
                </li>
              ))}
            </ul>
          ) : null}
          {order.intake_photo_public_ids.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {order.intake_photo_public_ids.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  src={cloudinaryUrl(id, {
                    width: 180,
                    height: 180,
                    crop: "fill",
                  }) ?? undefined}
                  alt="Laundry intake"
                  className="size-20 rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
            <AssignmentForm
              orderId={order.id}
              assignedStaffId={order.assigned_staff_id}
              staff={staff}
            />
            <div className="text-right">
              <p className="font-mono text-[10px] text-muted-foreground">
                {order.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {order.total_btn == null
                  ? "Awaiting count"
                  : formatBtn(order.total_btn)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/erp/laundry/orders/${order.id}/labels`}>
                <PrinterIcon className="size-3.5" />
                Bag labels
              </Link>
            </Button>
          </div>
          <div className="mt-3">
            <LaundryBagPrepareForm
              orderId={order.id}
              items={order.laundry_order_items}
              existingBags={bags}
              mode="desk"
              staffOptions={staff}
            />
          </div>
          {order.billed_at && order.status !== "delivered" ? (
            <CorrectionForm orderId={order.id} />
          ) : null}
        </article>
        );
      })}
    </div>
  );
}

function CorrectionForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(
    reopenLaundryCorrection,
    initial,
  );
  return (
    <details className="mt-3 border-t pt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Correct confirmed count or charge
      </summary>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="order_id" value={orderId} />
        <Input
          name="reason"
          placeholder="Required correction reason"
          maxLength={300}
          required
        />
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        {state.message ? (
          <p className="text-xs text-muted-foreground">{state.message}</p>
        ) : null}
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={pending}
        >
          {pending ? "Reopening…" : "Void charge and recount"}
        </Button>
      </form>
    </details>
  );
}

function AssignmentForm({
  orderId,
  assignedStaffId,
  staff,
}: {
  orderId: string;
  assignedStaffId: string | null;
  staff: StaffOption[];
}) {
  const [value, setValue] = useState(
    assignedStaffId ?? "__unassigned__",
  );
  return (
    <form action={assignLaundryOrder} className="min-w-0 flex-1">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="staff_id" value={value} />
      <Label className="mb-1 block text-xs">Assigned to</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {staff.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Save
        </Button>
      </div>
    </form>
  );
}

function ReceptionIntake({
  catalog,
  bookings,
}: {
  catalog: LaundryCatalogItem[];
  bookings: LaundryBookingOption[];
}) {
  const [state, action, pending] = useActionState(
    createDeskLaundryOrder,
    initial,
  );
  const roomOptions = bookings.flatMap((booking) =>
    booking.rooms.map((room) => ({ booking, room })),
  );
  const [roomKey, setRoomKey] = useState("");
  const selected = roomOptions.find(
    ({ booking, room }) => `${booking.id}|${room.id}` === roomKey,
  );
  const [guestName, setGuestName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const lines = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([catalogItemId, qty]) => ({ catalogItemId, qty }));

  function chooseRoom(value: string) {
    setRoomKey(value);
    const option = roomOptions.find(
      ({ booking, room }) => `${booking.id}|${room.id}` === value,
    );
    setGuestName(option?.booking.contactName ?? "");
  }
  return (
    <div className="mx-auto max-w-3xl rounded-xl border bg-card p-4 md:p-6">
      <h2 className="text-xl font-semibold">Reception laundry intake</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use this when the guest hands laundry to reception. Select the room,
        count garments, take the intake photo, and submit.
      </p>
      <form action={action} className="mt-5 space-y-5">
        <input
          type="hidden"
          name="booking_id"
          value={selected?.booking.id ?? ""}
        />
        <input
          type="hidden"
          name="room_unit_id"
          value={selected?.room.id ?? ""}
        />
        <input type="hidden" name="guest_name" value={guestName} />
        <input type="hidden" name="items" value={JSON.stringify(lines)} />
        <input
          type="hidden"
          name="photo_public_ids"
          value={JSON.stringify(photos)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Checked-in room</Label>
            <Select value={roomKey} onValueChange={chooseRoom}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select room and guest" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map(({ booking, room }) => (
                  <SelectItem
                    key={`${booking.id}-${room.id}`}
                    value={`${booking.id}|${room.id}`}
                  >
                    {room.label} · {booking.contactName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Guest name</Label>
            <Select value={guestName} onValueChange={setGuestName} disabled={!selected}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select guest" />
              </SelectTrigger>
              <SelectContent>
                {selected?.booking.guests.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Garments received</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog
              .filter((item) => item.is_active)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex min-h-14 items-center justify-between rounded-lg border px-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBtn(item.price_btn)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9"
                      onClick={() =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
                        }))
                      }
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <span className="w-7 text-center text-sm font-semibold">
                      {quantities[item.id] ?? 0}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9"
                      onClick={() =>
                        setQuantities((current) => ({
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
        </div>
        <LaundryPhotoUpload
          value={photos}
          onChange={setPhotos}
          context={
            selected ? { bookingId: selected.booking.id } : undefined
          }
          label="Take reception intake photo"
        />
        <div className="space-y-1.5">
          <Label htmlFor="desk-laundry-notes">Notes</Label>
          <Textarea
            id="desk-laundry-notes"
            name="notes"
            maxLength={500}
            rows={3}
            placeholder="Existing stains, delicate garment, pickup instructions…"
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
          className="min-h-11"
          disabled={pending || !selected || !guestName || lines.length === 0}
        >
          {pending ? "Creating…" : "Create laundry order"}
        </Button>
      </form>
    </div>
  );
}

function CatalogManager({ catalog }: { catalog: LaundryCatalogItem[] }) {
  const [selectedId, setSelectedId] = useState<string>("__new__");
  const selected = catalog.find((item) => item.id === selectedId);
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border bg-card p-3">
        <Button
          type="button"
          variant={selectedId === "__new__" ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => setSelectedId("__new__")}
        >
          Add laundry service
        </Button>
        <div className="mt-2 space-y-1">
          {catalog.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={selectedId === item.id ? "secondary" : "ghost"}
              className="w-full justify-between"
              onClick={() => setSelectedId(item.id)}
            >
              <span className="truncate">{item.name}</span>
              <span className="tabular-nums">{formatBtn(item.price_btn)}</span>
            </Button>
          ))}
        </div>
      </aside>
      <CatalogForm key={selectedId} item={selected} />
    </div>
  );
}

function CatalogForm({ item }: { item?: LaundryCatalogItem }) {
  const [state, action, pending] = useActionState(
    saveLaundryCatalogItem,
    initial,
  );
  return (
    <form action={action} className="rounded-xl border bg-card p-5">
      <input type="hidden" name="item_id" value={item?.id ?? ""} />
      <input type="hidden" name="is_active" value={item?.is_active === false ? "0" : "1"} />
      <h2 className="text-lg font-semibold">
        {item ? `Edit ${item.name}` : "Add laundry service"}
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="catalog-name">Name</Label>
          <Input id="catalog-name" name="name" defaultValue={item?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-category">Category</Label>
          <Input
            id="catalog-category"
            name="category"
            defaultValue={item?.category ?? "clothing"}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-unit">Unit</Label>
          <Input
            id="catalog-unit"
            name="unit_label"
            defaultValue={item?.unit_label ?? "piece"}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-price">Price (Nu)</Label>
          <Input
            id="catalog-price"
            name="price_btn"
            type="number"
            min="0"
            step="0.01"
            defaultValue={item?.price_btn}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-turnaround">Turnaround hours</Label>
          <Input
            id="catalog-turnaround"
            name="turnaround_hours"
            type="number"
            min="1"
            max="168"
            defaultValue={item?.turnaround_hours ?? 24}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-sort">Sort order</Label>
          <Input
            id="catalog-sort"
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Checkbox
          id="catalog-gst"
          name="gst_applicable"
          defaultChecked={item?.gst_applicable ?? true}
        />
        <Label htmlFor="catalog-gst">GST applies</Label>
      </div>
      {state.error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert className="mt-4">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" variant="citrus" className="mt-5" disabled={pending}>
        {pending ? "Saving…" : "Save service"}
      </Button>
    </form>
  );
}
