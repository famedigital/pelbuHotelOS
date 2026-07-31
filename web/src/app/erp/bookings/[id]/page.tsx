import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { DeskListShell, StatusPill } from "@/components/erp/DeskListShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { boardActionLabel } from "@/lib/arrival-board";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Booking | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Statuses where the check-in screen has a real form to show. */
const CHECKIN_STATUSES = ["pending", "confirmed", "checked_in"];

type Props = { params: Promise<{ id: string }> };

export default async function BookingDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const { data, error } = await admin
    .from("bookings")
    .select(
      `id, contact_name, contact_phone, contact_email, check_in, check_out, status,
       source, channel_source, guest_origin, guide_number, payment_mode, adults, rooms,
       notes, created_at, confirmed_at, checked_in_at, checked_out_at, cancelled_at,
       cancel_reason, hold_expires_at, hold_extended_count, token_required_btn,
       token_received_btn, quoted_total_btn, meal_plan_code,
       agents(company_name),
       booking_rooms(qty, inventory_kind, room_types(name, code)),
       booking_guests(full_name, nationality, passport_or_cid, sort_order),
       room_assignments(room_units(label, hk_status)),
       folios(id, status, folio_lines(total_btn, status)),
       payments(id, amount_btn, method, kind, reference, created_at)`,
    )
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw new Error(`Could not load booking: ${error.message}`);
  if (!data) notFound();

  const status = (data.status as string) ?? "unknown";
  const agent = firstOf(data.agents as MaybeList<{ company_name?: string }>);
  const guests = sortGuests(
    (data.booking_guests as GuestRow[] | null) ?? [],
  );
  const roomLabels = assignedRoomLabels(
    (data.room_assignments as AssignmentRow[] | null) ?? [],
  );
  const folios = (data.folios as FolioRow[] | null) ?? [];
  const openFolio = folios.find((f) => f.status === "open") ?? folios[0];
  const folioBalance = (openFolio?.folio_lines ?? [])
    .filter((l) => l.status === "posted")
    .reduce((sum, l) => sum + Number(l.total_btn ?? 0), 0);
  const payments = ((data.payments as PaymentRow[] | null) ?? []).slice().sort(
    (a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  const tokenRequired = Number(data.token_required_btn ?? 0);
  const tokenReceived = Number(data.token_received_btn ?? 0);
  const canCheckIn = CHECKIN_STATUSES.includes(status);

  return (
    <DeskListShell
      eyebrow="Booking"
      heading={(data.contact_name as string) ?? "Guest"}
      blurb={`${data.check_in as string} → ${data.check_out as string} · ${
        Number(data.rooms ?? 0)
      } room(s) · ${Number(data.adults ?? 0)} pax`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill value={status} />
        <span className="font-mono text-xs text-muted-foreground">
          {data.id as string}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {canCheckIn ? (
          <Button asChild>
            <Link href={`/erp/check-in?id=${data.id as string}`}>
              {boardActionLabel(status)}
            </Link>
          </Button>
        ) : null}
        {openFolio ? (
          <Button asChild variant="outline">
            <Link href={`/erp/folios/${openFolio.id}`}>Open folio</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/erp/calendar">Room rack</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/erp/reservations">Back to reservations</Link>
        </Button>
      </div>

      {status === "held" ? (
        <Card>
          <CardHeader>
            <CardTitle>Hold awaiting token</CardTitle>
            <CardDescription>
              This booking cannot be checked in until the token is confirmed.
              {data.hold_expires_at
                ? ` Hold expires ${fmtDateTime(data.hold_expires_at as string)}.`
                : ""}
              {Number(data.hold_extended_count ?? 0) > 0
                ? " Already extended once."
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingLifecycleActions
              bookingId={data.id as string}
              status={status}
              tokenRequired={tokenRequired}
            />
          </CardContent>
        </Card>
      ) : null}

      {["pending", "confirmed", "checked_in"].includes(status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>
              Cancel or mark no-show if the guest is not coming.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingLifecycleActions
              bookingId={data.id as string}
              status={status}
              tokenRequired={tokenRequired}
            />
          </CardContent>
        </Card>
      ) : null}

      {["cancelled", "no_show", "expired"].includes(status) ? (
        <Card>
          <CardHeader>
            <CardTitle>Closed booking</CardTitle>
            <CardDescription>
              {status === "expired"
                ? "The hold expired and its inventory was released."
                : `Marked ${status.replace(/_/g, " ")}${
                    data.cancelled_at
                      ? ` on ${fmtDateTime(data.cancelled_at as string)}`
                      : ""
                  }.`}
              {data.cancel_reason ? ` Reason: ${data.cancel_reason as string}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stay</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Contact" value={data.contact_phone as string} />
              <Field label="Email" value={data.contact_email as string} />
              <Field
                label="Source"
                value={
                  [data.source, data.channel_source]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
              <Field label="Agent" value={agent?.company_name ?? null} />
              <Field label="Origin" value={data.guest_origin as string} />
              <Field label="Guide #" value={data.guide_number as string} />
              <Field label="Payment mode" value={data.payment_mode as string} />
              <Field label="Meal plan" value={data.meal_plan_code as string} />
              <Field
                label="Rooms assigned"
                value={roomLabels.length ? roomLabels.join(", ") : null}
              />
              <Field
                label="Created"
                value={
                  data.created_at ? fmtDateTime(data.created_at as string) : null
                }
              />
            </dl>
            {data.notes ? (
              <p className="mt-4 rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                {data.notes as string}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
            <CardDescription>
              Token {formatBtn(tokenReceived)} received of{" "}
              {formatBtn(tokenRequired)} required
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field
                label="Quoted total"
                value={
                  data.quoted_total_btn != null
                    ? formatBtn(Number(data.quoted_total_btn))
                    : null
                }
              />
              <Field
                label="Folio balance"
                value={openFolio ? formatBtn(folioBalance) : null}
              />
            </dl>
            <h3 className="mt-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Payments
            </h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No payments recorded.
              </p>
            ) : (
              <ul className="mt-2 divide-y rounded-md border border-border/70">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">
                      {formatBtn(Number(p.amount_btn ?? 0))}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {[p.kind, p.method].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.reference ? `${p.reference} · ` : ""}
                      {p.created_at ? fmtDateTime(p.created_at) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rooms &amp; guests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Booked room types
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {((data.booking_rooms as BookingRoomRow[] | null) ?? []).length ===
              0 ? (
                <li className="text-muted-foreground">No room lines.</li>
              ) : (
                ((data.booking_rooms as BookingRoomRow[] | null) ?? []).map(
                  (line, i) => {
                    const rt = firstOf(line.room_types);
                    return (
                      <li key={`line-${i}`} className="text-foreground">
                        {Number(line.qty)} ×{" "}
                        {rt?.name ?? rt?.code ?? "Room"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {line.inventory_kind?.replace(/_/g, " ")}
                        </span>
                      </li>
                    );
                  },
                )
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Guests on file ({guests.length})
            </h3>
            {guests.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No guest documents captured yet — they are collected at check-in.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {guests.map((g, i) => (
                  <li key={`guest-${i}`} className="text-foreground">
                    {g.full_name ?? "Guest"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[g.nationality, g.passport_or_cid]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </DeskListShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground">{value || "—"}</dd>
    </div>
  );
}

type MaybeList<T> = T | T[] | null;
type GuestRow = {
  full_name?: string | null;
  nationality?: string | null;
  passport_or_cid?: string | null;
  sort_order?: number | null;
};
type AssignmentRow = {
  room_units: MaybeList<{ label?: string; hk_status?: string }>;
};
type FolioRow = {
  id: string;
  status?: string;
  folio_lines?: Array<{ total_btn?: number; status?: string }> | null;
};
type PaymentRow = {
  id: string;
  amount_btn?: number | null;
  method?: string | null;
  kind?: string | null;
  reference?: string | null;
  created_at?: string | null;
};
type BookingRoomRow = {
  qty: number;
  inventory_kind?: string | null;
  room_types: MaybeList<{ name?: string; code?: string }>;
};

function firstOf<T>(value: MaybeList<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function sortGuests(rows: GuestRow[]): GuestRow[] {
  return rows
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function assignedRoomLabels(rows: AssignmentRow[]): string[] {
  return rows
    .map((row) => firstOf(row.room_units)?.label)
    .filter((label): label is string => Boolean(label));
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
