"use client";

import {
  logoutLaundryGuest,
  submitGuestLaundry,
  submitPublicWalkInLaundry,
  validateLaundryGuest,
  type LaundryGuestState,
} from "@/app/actions/laundry";
import { LaundryPhotoUpload } from "@/components/laundry/LaundryPhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LAUNDRY_STATUS_LABEL,
  type LaundryCatalogItem,
  type LaundryOrder,
} from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { LaundryLiveRefresh } from "@/components/laundry/LaundryLiveRefresh";
import { CreditCardIcon, MinusIcon, PlusIcon, ShirtIcon } from "lucide-react";
import Link from "next/link";
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
  if (session) {
    return (
      <GuestIntake session={session} catalog={catalog} orders={orders} />
    );
  }

  return (
    <Tabs defaultValue="walk-in" className="space-y-5">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="walk-in">Walk-in / day guest</TabsTrigger>
        <TabsTrigger value="room">In-house room guest</TabsTrigger>
      </TabsList>
      <TabsContent value="walk-in">
        <PublicWalkInIntake catalog={catalog} />
      </TabsContent>
      <TabsContent value="room">
        <GuestValidation roomPrefill={roomPrefill} />
      </TabsContent>
    </Tabs>
  );
}

function PublicWalkInIntake({ catalog }: { catalog: LaundryCatalogItem[] }) {
  const [state, action, pending] = useActionState(
    submitPublicWalkInLaundry,
    initial,
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([catalogItemId, qty]) => ({ catalogItemId, qty })),
    [quantities],
  );
  const estimate = useMemo(() => {
    return lines.reduce((sum, line) => {
      const item = catalog.find((row) => row.id === line.catalogItemId);
      return sum + (item ? item.price_btn * line.qty : 0);
    }, 0);
  }, [catalog, lines]);

  function step(id: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(100, (current[id] ?? 0) + delta)),
    }));
  }

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Public laundry
      </p>
      <h1 className="mt-2 font-display text-3xl">Drop-off service</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        For walk-in guests and visitors — name and mobile required. Pay by bank
        transfer QR before we start processing.
      </p>

      <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="items" value={JSON.stringify(lines)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="public_guest_name">Full name</Label>
            <Input
              id="public_guest_name"
              name="guest_name"
              autoComplete="name"
              maxLength={100}
              required
              className="min-h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="public_guest_phone">Mobile number</Label>
            <Input
              id="public_guest_phone"
              name="guest_phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              required
              className="min-h-12"
              placeholder="17xxxxxx / +975…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="room_hint">Room (optional)</Label>
          <Input
            id="room_hint"
            name="room_hint"
            autoComplete="off"
            maxLength={30}
            className="min-h-12"
            placeholder="If you are staying with us, enter your room"
          />
        </div>

        {catalog.length === 0 ? (
          <Alert>
            <AlertDescription>
              Laundry pricing is being loaded. Please call reception or visit
              the front desk.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label>Garments</Label>
            {catalog.map((item) => {
              const qty = quantities[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 py-2"
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
                      className="size-10"
                      onClick={() => step(item.id, -1)}
                      aria-label={`Remove one ${item.name}`}
                    >
                      <MinusIcon className="size-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold tabular-nums">
                      {qty}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant={qty ? "default" : "citrus"}
                      className="size-10"
                      onClick={() => step(item.id, 1)}
                      aria-label={`Add one ${item.name}`}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {estimate > 0 ? (
              <p className="text-sm font-semibold tabular-nums">
                Estimated {formatBtn(estimate)} + service/GST at payment
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="public_laundry_notes">Instructions</Label>
          <Textarea
            id="public_laundry_notes"
            name="notes"
            maxLength={500}
            rows={3}
            placeholder="Stains, fabric care, when you need it back…"
          />
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok && state.orderId ? (
          <Alert>
            <AlertDescription className="space-y-3">
              <p>
                Order {state.orderId.slice(0, 8).toUpperCase()} submitted.
                {state.estimatedTotalBtn
                  ? ` Total due ${formatBtn(state.estimatedTotalBtn)}.`
                  : ""}
              </p>
              {state.payUrl ? (
                <Button asChild variant="citrus" className="min-h-11 w-full">
                  <Link href={state.payUrl}>
                    <CreditCardIcon className="size-4" />
                    Pay by bank transfer
                  </Link>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          variant="citrus"
          className="min-h-12 w-full"
          disabled={pending || lines.length === 0 || catalog.length === 0}
        >
          <ShirtIcon className="size-4" />
          {pending ? "Submitting…" : "Submit & get payment link"}
        </Button>
      </form>
    </section>
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
        In-house guest
      </p>
      <h1 className="mt-2 font-display text-3xl">Room laundry</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Enter the same full name used at check-in and your room number. Charges
        post to your room folio after the attendant confirms the count.
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
          <div className="flex flex-col items-end gap-2">
            <LaundryLiveRefresh />
            <form action={logoutLaundryGuest}>
              <Button type="submit" variant="ghost" size="sm">
                Change guest
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-2xl">What are we collecting?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an estimate. The laundry attendant confirms the final count
          before your room folio is charged.
        </p>
        {catalog.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Laundry service is not ready for self-service yet.
            </p>
            <p className="mt-2 leading-6">
              Our team is still loading the garment price list. Please call
              reception or visit the front desk to request pickup — staff can
              take your order manually.
            </p>
          </div>
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
