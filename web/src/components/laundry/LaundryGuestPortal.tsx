"use client";

import {
  logoutLaundryGuest,
  submitGuestLaundry,
  validateLaundryGuest,
  type LaundryGuestState,
} from "@/app/actions/laundry";
import { LaundryPhotoUpload } from "@/components/laundry/LaundryPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LAUNDRY_STATUS_LABEL,
  type LaundryCatalogItem,
  type LaundryOrder,
} from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { MinusIcon, PlusIcon, ShirtIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

const initial: LaundryGuestState = { ok: false };

export function LaundryGuestPortal({
  session,
  catalog,
  orders,
  roomPrefill,
}: {
  session: {
    propertyId: string;
    bookingId: string;
    guestName: string;
  } | null;
  catalog: LaundryCatalogItem[];
  orders: LaundryOrder[];
  roomPrefill?: string;
}) {
  if (!session) return <GuestValidation roomPrefill={roomPrefill} />;
  return (
    <GuestIntake session={session} catalog={catalog} orders={orders} />
  );
}

function GuestValidation({ roomPrefill }: { roomPrefill?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    validateLaundryGuest,
    initial,
  );
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Private guest access
      </p>
      <h1 className="mt-2 font-display text-3xl">Room laundry</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Enter the same full name used at check-in and your room number. We never
        show a guest or room list.
      </p>
      {state.error ? (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={action} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="guest_name">Guest full name</Label>
          <Input
            id="guest_name"
            name="guest_name"
            autoComplete="name"
            maxLength={100}
            required
            className="min-h-12"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room_label">Room number</Label>
          <Input
            id="room_label"
            name="room_label"
            defaultValue={roomPrefill}
            autoComplete="off"
            maxLength={30}
            required
            className="min-h-12"
          />
        </div>
        <Button
          type="submit"
          variant="citrus"
          className="min-h-12 w-full"
          disabled={pending}
        >
          {pending ? "Checking…" : "Continue securely"}
        </Button>
      </form>
    </section>
  );
}

function GuestIntake({
  session,
  catalog,
  orders,
}: {
  session: { propertyId: string; bookingId: string; guestName: string };
  catalog: LaundryCatalogItem[];
  orders: LaundryOrder[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitGuestLaundry, initial);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [settledOrderId, setSettledOrderId] = useState<string | null>(null);
  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([catalogItemId, qty]) => ({ catalogItemId, qty })),
    [quantities],
  );
  // Reset the draft during render when a new order lands (React-recommended
  // "adjust state on change" pattern; avoids setState-in-effect cascades).
  if (state.ok && state.orderId && state.orderId !== settledOrderId) {
    setSettledOrderId(state.orderId);
    setQuantities({});
    setPhotos([]);
  }
  useEffect(() => {
    if (settledOrderId) router.refresh();
  }, [router, settledOrderId]);

  function step(id: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(100, (current[id] ?? 0) + delta)),
    }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Welcome
            </p>
            <h1 className="mt-1 font-display text-2xl">{session.guestName}</h1>
          </div>
          <form action={logoutLaundryGuest}>
            <Button type="submit" variant="ghost" size="sm">
              Change guest
            </Button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-2xl">What are we collecting?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an estimate. The laundry attendant confirms the final count
          before your room folio is charged.
        </p>
        {catalog.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Laundry pricing is being prepared. Please call reception.
          </p>
        ) : (
          <div className="mt-5 space-y-2">
            {catalog.map((item) => {
              const qty = quantities[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBtn(item.price_btn)} / {item.unit_label}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-11"
                      onClick={() => step(item.id, -1)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <span className="w-9 text-center font-semibold tabular-nums">
                      {qty}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant={qty ? "default" : "citrus"}
                      className="size-11"
                      onClick={() => step(item.id, 1)}
                      aria-label={`Add one ${item.name}`}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form action={action} className="mt-6 space-y-4">
          <input type="hidden" name="items" value={JSON.stringify(lines)} />
          <input
            type="hidden"
            name="photo_public_ids"
            value={JSON.stringify(photos)}
          />
          <LaundryPhotoUpload
            value={photos}
            onChange={setPhotos}
            context={{ bookingId: session.bookingId }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="laundry_notes">Pickup or garment instructions</Label>
            <Textarea
              id="laundry_notes"
              name="notes"
              maxLength={500}
              rows={3}
              placeholder="Stains, delicate fabric, preferred pickup time…"
            />
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.ok ? (
            <Alert>
              <AlertDescription>
                Request {state.orderId?.slice(0, 8).toUpperCase()} submitted.
                Reception and laundry can now track it.
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            variant="citrus"
            className="min-h-12 w-full"
            disabled={pending || lines.length === 0}
          >
            <ShirtIcon className="size-4" />
            {pending ? "Submitting…" : "Request collection"}
          </Button>
        </form>
      </section>

      {orders.length > 0 ? (
        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-xl">Your laundry</h2>
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-sm">
                    {order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <Badge
                    variant={
                      order.status === "exception"
                        ? "destructive"
                        : order.status === "delivered"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {LAUNDRY_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {order.laundry_order_items
                    .map(
                      (item) =>
                        `${item.confirmed_qty ?? item.requested_qty}× ${item.name_snapshot}`,
                    )
                    .join(", ")}
                </p>
                {order.total_btn != null ? (
                  <p className="mt-2 text-sm font-semibold tabular-nums">
                    Folio charge {formatBtn(order.total_btn)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Final count and charge pending.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
