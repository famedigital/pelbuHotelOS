"use client";

import {
  createDeskLaundryOrder,
  saveLaundryCatalogItem,
  type ErpLaundryState,
} from "@/app/actions/erp-laundry";
import { LaundryBoardPanel } from "@/components/laundry/LaundryBoardPanel";
import { LaundryLiveRefresh } from "@/components/laundry/LaundryLiveRefresh";
import { LaundryPhotoUpload } from "@/components/laundry/LaundryPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  type LaundryBag,
  type LaundryCatalogItem,
  type LaundryOrder,
} from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { MinusIcon, PlusIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

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
  bookingsError,
  staff,
}: {
  catalog: LaundryCatalogItem[];
  orders: LaundryOrder[];
  bagsByOrder: Record<string, LaundryBag[]>;
  bookings: LaundryBookingOption[];
  bookingsError?: string | null;
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
        <LaundryBoardPanel
          orders={orders}
          bagsByOrder={bagsByOrder}
          staff={staff}
        />
      </TabsContent>
      <TabsContent value="intake">
        <ReceptionIntake
          catalog={catalog}
          bookings={bookings}
          bookingsError={bookingsError}
          staff={staff}
        />
      </TabsContent>
      <TabsContent value="pricing">
        <CatalogManager catalog={catalog} />
      </TabsContent>
    </Tabs>
  );
}

function ReceptionIntake({
  catalog,
  bookings,
  bookingsError,
  staff,
}: {
  catalog: LaundryCatalogItem[];
  bookings: LaundryBookingOption[];
  bookingsError?: string | null;
  staff: StaffOption[];
}) {
  const [state, action, pending] = useActionState(
    createDeskLaundryOrder,
    initial,
  );
  usePendingFeedback(pending, "Creating laundry order…");
  const roomOptions = bookings.flatMap((booking) =>
    booking.rooms.map((room) => ({ booking, room })),
  );
  const unassigned = bookings.filter((booking) => booking.rooms.length === 0);
  const [roomKey, setRoomKey] = useState("");
  const selected = roomOptions.find(
    ({ booking, room }) => `${booking.id}|${room.id}` === roomKey,
  );
  const [guestName, setGuestName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const activeCatalog = catalog.filter((item) => item.is_active);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
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

      <InHouseStatus
        error={bookingsError}
        roomCount={roomOptions.length}
        unassigned={unassigned}
      />

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
          name="prepared_by_staff_id"
          value={staff[0]?.id ?? ""}
        />
        <input
          type="hidden"
          name="photo_public_ids"
          value={JSON.stringify(photos)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Checked-in room</Label>
            <Select
              value={roomKey}
              onValueChange={chooseRoom}
              disabled={roomOptions.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    roomOptions.length === 0
                      ? "No rooms in house"
                      : "Select room and guest"
                  }
                />
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
            {roomOptions.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {roomOptions.length} room
                {roomOptions.length === 1 ? "" : "s"} in house
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Guest name</Label>
            <Select
              value={guestName}
              onValueChange={setGuestName}
              disabled={!selected}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    selected ? "Select guest" : "Pick a room first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(selected?.booking.guests ?? []).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Garments received</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowQuickAdd((value) => !value)}
              >
                {showQuickAdd ? "Hide add type" : "Add cloth type"}
              </Button>
            </div>
          </div>
          {activeCatalog.length === 0 ? (
            <Alert>
              <AlertDescription>
                No garment types in the catalog yet — add your first type below,
                or open the{" "}
                <span className="font-medium">Pricing</span> tab for the full
                list.
              </AlertDescription>
            </Alert>
          ) : null}
          {showQuickAdd ? (
            <QuickAddCatalogForm onSaved={() => setShowQuickAdd(false)} />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {activeCatalog.map((item) => (
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
            <AlertDescription>
              {state.message}{" "}
              {state.labelsUrl ? (
                <Button asChild size="sm" variant="citrus" className="ml-2">
                  <Link href={state.labelsUrl}>
                    <PrinterIcon className="size-3.5" />
                    Print bag QR
                  </Link>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          variant="citrus"
          className="min-h-11"
          disabled={
            pending ||
            !selected ||
            !guestName ||
            lines.length === 0 ||
            activeCatalog.length === 0
          }
        >
          {pending ? "Creating…" : "Create laundry order"}
        </Button>
      </form>
    </div>
  );
}

/**
 * The room picker is only as good as the in-house list behind it. An empty
 * dropdown used to look identical whether nobody was checked in or the query
 * had failed, so say which it is.
 */
function InHouseStatus({
  error,
  roomCount,
  unassigned,
}: {
  error?: string | null;
  roomCount: number;
  unassigned: LaundryBookingOption[];
}) {
  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertDescription>
          Could not load in-house rooms: {error}. Reception intake needs a
          checked-in room — retry, or take the order via the guest room QR.
        </AlertDescription>
      </Alert>
    );
  }

  if (roomCount === 0) {
    return (
      <Alert className="mt-4">
        <AlertDescription>
          {unassigned.length > 0 ? (
            <>
              {unassigned.length} guest
              {unassigned.length === 1 ? " is" : "s are"} checked in but have no
              room assigned yet, so there is nothing to pick here. Assign a room
              on{" "}
              <Link href="/erp/check-in" className="underline underline-offset-4">
                check-in
              </Link>{" "}
              first.
            </>
          ) : (
            <>
              No guests are checked in right now, so there is no room to take
              laundry against. Check a guest in from{" "}
              <Link href="/erp/check-in" className="underline underline-offset-4">
                check-in
              </Link>
              , or let the guest submit from the room QR.
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (unassigned.length > 0) {
    return (
      <Alert className="mt-4">
        <AlertDescription>
          {unassigned.length} in-house guest
          {unassigned.length === 1 ? "" : "s"} not shown below — no room
          assigned yet.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function QuickAddCatalogForm({ onSaved }: { onSaved?: () => void }) {
  const [state, action, pending] = useActionState(
    saveLaundryCatalogItem,
    initial,
  );
  const [gstApplicable, setGstApplicable] = useState(true);
  useEffect(() => {
    if (state.ok && state.message) onSaved?.();
  }, [state.ok, state.message, onSaved]);
  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-dashed bg-secondary/30 p-3"
    >
      <input type="hidden" name="item_id" value="" />
      <input type="hidden" name="is_active" value="1" />
      <input type="hidden" name="gst_applicable" value={gstApplicable ? "1" : "0"} />
      <p className="text-sm font-medium">Quick add garment type</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="quick-catalog-name">Name</Label>
          <Input
            id="quick-catalog-name"
            name="name"
            placeholder="e.g. Shirt, Trouser, Bedsheet"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quick-catalog-price">Price (Nu)</Label>
          <Input
            id="quick-catalog-price"
            name="price_btn"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>
      <input type="hidden" name="category" value="clothing" />
      <input type="hidden" name="unit_label" value="piece" />
      <input type="hidden" name="turnaround_hours" value="24" />
      <input type="hidden" name="sort_order" value="0" />
      <div className="flex items-center gap-2">
        <Checkbox
          id="quick-catalog-gst"
          checked={gstApplicable}
          onCheckedChange={(checked) => setGstApplicable(checked === true)}
        />
        <Label htmlFor="quick-catalog-gst">GST applies</Label>
      </div>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-xs text-muted-foreground">{state.message}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save type"}
      </Button>
    </form>
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
  const [gstApplicable, setGstApplicable] = useState(item?.gst_applicable ?? true);
  return (
    <form action={action} className="rounded-xl border bg-card p-5">
      <input type="hidden" name="item_id" value={item?.id ?? ""} />
      <input type="hidden" name="is_active" value={item?.is_active === false ? "0" : "1"} />
      <input type="hidden" name="gst_applicable" value={gstApplicable ? "1" : "0"} />
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
          checked={gstApplicable}
          onCheckedChange={(checked) => setGstApplicable(checked === true)}
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
