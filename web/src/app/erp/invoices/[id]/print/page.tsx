import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { formatBtn } from "@/lib/pricing";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { nightsBetween } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Tax invoice | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type FolioLine = {
  id: string;
  description: string;
  total_btn: number;
  gst_btn: number;
  status: string;
  source_type: string;
  reverses_line_id?: string | null;
};

type MaybeList<T> = T | T[] | null;

type BookingRoomRow = {
  qty: number;
  inventory_kind: string | null;
  room_types:
    | { name?: string | null; code?: string | null }
    | { name?: string | null; code?: string | null }[]
    | null;
};

type RoomAssignmentRow = {
  room_units: MaybeList<{ label?: string | null }>;
};

function firstOf<T>(value: MaybeList<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Calendar stay dates (YYYY-MM-DD) and issue timestamps → hotel en-GB in Asia/Thimphu. */
function fmtHotelDate(iso: string): string {
  const raw = String(iso).trim();
  if (!raw) return "—";
  // Date-only: noon UTC avoids DST edge noise when formatting in Asia/Thimphu.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00Z`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Thimphu",
  });
}

function inventoryKindLabel(kind: string | null | undefined): string | null {
  if (!kind || kind === "sellable_guest") return null;
  if (kind === "guide_comp") return "guide";
  if (kind === "driver_comp") return "driver";
  if (kind === "staff") return "staff";
  return kind.replace(/_/g, " ");
}

function formatRoomProductLine(row: BookingRoomRow): string {
  const rt = firstOf(row.room_types);
  const name = rt?.name?.trim() || rt?.code?.trim() || "Room";
  const code = rt?.code?.trim();
  const qty = Math.max(1, Number(row.qty) || 1);
  const kind = inventoryKindLabel(row.inventory_kind);
  const base =
    code && code.toLowerCase() !== name.toLowerCase()
      ? `${qty}× ${name} (${code})`
      : `${qty}× ${name}`;
  return kind ? `${base} · ${kind}` : base;
}

/** Printable fiscal invoice (browser Print → PDF) + email. */
export default async function FiscalInvoicePrintPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const activePropertyId = await resolveActivePropertyId(admin);

  // fiscal_documents has no total_btn/gst_btn columns — amounts come from folio lines.
  const { data: doc, error: docError } = await admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, doc_kind, property_id, folio_id, issued_at, status, meta",
    )
    .eq("id", id)
    .maybeSingle();

  if (docError) {
    console.error("fiscal invoice print load failed", docError);
    notFound();
  }
  if (!doc || (doc.status as string) !== "issued") notFound();

  try {
    assertDeskProperty(activePropertyId, doc.property_id as string, "Document");
  } catch {
    notFound();
  }

  const property = await loadProperty(admin, activePropertyId);
  const folioId = doc.folio_id as string | null;
  const { data: folio } = folioId
    ? await admin
        .from("folios")
        .select(
          "label, booking_id, folio_lines(id, description, total_btn, gst_btn, status, source_type, reverses_line_id)",
        )
        .eq("id", folioId)
        .maybeSingle()
    : { data: null };

  let guestEmail: string | null = null;
  let guestName: string | null = null;
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  let agentName: string | null = null;
  let stayNights: number | null = null;
  let roomProductLines: string[] = [];
  let roomUnitLabels: string[] = [];
  let quotedTotalBtn: number | null = null;
  let mealPlanCode: string | null = null;
  let mealPlanAmountBtn: number | null = null;
  let bookingRoomsCount: number | null = null;

  const bookingId = folio?.booking_id as string | null | undefined;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select(
        `contact_email, contact_name, check_in, check_out, rooms,
         quoted_total_btn, meal_plan_code, meal_plan_amount_btn, agent_id,
         agents(company_name),
         booking_rooms(qty, inventory_kind, room_types(name, code)),
         room_assignments(room_units(label))`,
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (booking) {
      guestEmail = (booking.contact_email as string | null) ?? null;
      guestName = (booking.contact_name as string | null) ?? null;
      checkIn = (booking.check_in as string | null) ?? null;
      checkOut = (booking.check_out as string | null) ?? null;
      if (checkIn && checkOut) {
        stayNights = nightsBetween(checkIn, checkOut);
      }

      const agentRaw = booking.agents as MaybeList<{
        company_name?: string | null;
      }>;
      const company = firstOf(agentRaw)?.company_name?.trim();
      agentName = company || null;

      roomProductLines = (
        (booking.booking_rooms as BookingRoomRow[] | null) ?? []
      )
        .map(formatRoomProductLine)
        .filter(Boolean);

      roomUnitLabels = (
        (booking.room_assignments as RoomAssignmentRow[] | null) ?? []
      )
        .map((row) => firstOf(row.room_units)?.label?.trim())
        .filter((label): label is string => Boolean(label));

      const qt = booking.quoted_total_btn;
      if (qt != null && Number.isFinite(Number(qt))) {
        quotedTotalBtn = Number(qt);
      }

      mealPlanCode =
        typeof booking.meal_plan_code === "string" &&
        booking.meal_plan_code.trim()
          ? booking.meal_plan_code.trim()
          : null;
      const mealAmt = booking.meal_plan_amount_btn;
      if (mealAmt != null && Number.isFinite(Number(mealAmt)) && Number(mealAmt) > 0) {
        mealPlanAmountBtn = Number(mealAmt);
      }

      const roomsField = booking.rooms;
      if (roomsField != null && Number(roomsField) > 0) {
        bookingRoomsCount = Number(roomsField);
      }
    }
  }

  const lines = guestVisibleBalanceLines(
    ((folio?.folio_lines as FolioLine[] | null) ?? []).map((l) => ({
      ...l,
      id: l.id,
      status: l.status,
      total_btn: Number(l.total_btn),
      reverses_line_id: l.reverses_line_id ?? null,
    })),
  ).filter(
    (l) => l.source_type !== "payment" && l.source_type !== "deposit",
  );

  const totalBtn = lines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const gstBtn = lines.reduce((s, l) => s + Number(l.gst_btn ?? 0), 0);
  /** GST exclusive-add: line total = net + GST. */
  const netBtn = totalBtn - gstBtn;

  const kind = doc.doc_kind as string;
  const kindLabel =
    kind === "receipt"
      ? "Receipt"
      : kind === "credit_note"
        ? "Credit note"
        : "Tax invoice";
  const kindTitle =
    kind === "receipt"
      ? "RECEIPT"
      : kind === "credit_note"
        ? "CREDIT NOTE"
        : "TAX INVOICE";

  const meta =
    doc.meta && typeof doc.meta === "object"
      ? (doc.meta as Record<string, unknown>)
      : {};
  const memo =
    typeof meta.memo === "string"
      ? meta.memo
      : typeof meta.note === "string"
        ? meta.note
        : null;

  const hotelName = property?.name ?? "Hotel";
  const legalName = property?.legal_name?.trim() || null;
  const logoSrc = property?.logo_public_id
    ? cloudinaryUrl(property.logo_public_id, { width: 200, crop: "fit" })
    : null;
  const issueDate = fmtHotelDate(String(doc.issued_at));
  const folioLabel = (folio?.label as string | null) ?? null;

  const hasStaySummary = Boolean(
    bookingId &&
      (checkIn ||
        checkOut ||
        stayNights != null ||
        agentName ||
        roomProductLines.length > 0 ||
        roomUnitLabels.length > 0 ||
        quotedTotalBtn != null ||
        mealPlanCode ||
        bookingRoomsCount != null),
  );

  return (
    <div className="erp mx-auto max-w-[860px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {kindLabel} print
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {doc.doc_no as string}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folioId ? (
            <a
              href={`/erp/folios/${folioId}`}
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
            >
              Back to folio
            </a>
          ) : null}
          <a
            href="/erp/invoices"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted"
          >
            All invoices
          </a>
          <DocPrintControls defaultSize="a4" printLabel="Print / PDF" />
        </div>
      </div>

      {folioId && (kind === "invoice" || kind === "receipt") ? (
        <div className="print:hidden">
          <FiscalDocEmailForm
            folioId={folioId}
            fiscalDocId={doc.id as string}
            docKind={kind === "receipt" ? "receipt" : "invoice"}
            defaultEmail={guestEmail}
            defaultName={guestName}
          />
        </div>
      ) : null}

      <article
        className="fiscal-invoice-sheet doc-print-sheet mx-auto max-w-[720px] border border-neutral-300 bg-white px-8 py-9 text-neutral-900 shadow-sm print:border-0 print:p-0 print:shadow-none"
        aria-label={`${kindLabel} ${doc.doc_no as string}`}
      >
        {/* Letterhead */}
        <header className="fiscal-invoice-letterhead flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-neutral-500 uppercase">
              {legalName && legalName !== hotelName ? hotelName : "Hotel tax invoice"}
            </p>
            <h1 className="mt-1 text-[1.65rem] leading-tight font-semibold tracking-tight text-neutral-950">
              {hotelName}
            </h1>
            {legalName && legalName !== hotelName ? (
              <p className="mt-1 text-sm text-neutral-600">{legalName}</p>
            ) : null}
            <div className="mt-3 space-y-0.5 text-[12.5px] leading-relaxed text-neutral-600">
              {property?.address ? <p>{property.address}</p> : null}
              <p className="flex flex-wrap gap-x-3 gap-y-0.5">
                {property?.phone ? <span>Tel {property.phone}</span> : null}
                {property?.email ? <span>{property.email}</span> : null}
              </p>
              {property?.tax_id ? (
                <p className="pt-1 font-medium text-neutral-800">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    TPN / Tax ID
                  </span>{" "}
                  <span className="font-mono tabular-nums">{property.tax_id}</span>
                </p>
              ) : null}
            </div>
          </div>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary print asset; next/image unnecessary for static print
            <img
              src={logoSrc}
              alt={`${hotelName} logo`}
              className="h-16 w-auto shrink-0 object-contain print:h-14"
            />
          ) : null}
        </header>

        {/* Document banner + meta */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-300 pb-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.28em] text-neutral-500 uppercase">
              Fiscal document
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[0.04em] text-neutral-950 uppercase">
              {kindTitle}
            </p>
          </div>
          <dl className="grid min-w-[12rem] grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-right text-sm">
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
              Document no.
            </dt>
            <dd className="font-mono text-[15px] font-semibold tabular-nums text-neutral-950">
              {doc.doc_no as string}
            </dd>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
              Issue date
            </dt>
            <dd className="tabular-nums text-neutral-800">{issueDate}</dd>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
              Status
            </dt>
            <dd className="text-neutral-800 capitalize">
              {String(doc.status)}
            </dd>
          </dl>
        </div>

        {/* Guest / folio identity */}
        {(guestName || folioLabel || bookingId) && (
          <section
            className="mt-5 grid gap-4 border-b border-neutral-200 pb-5 sm:grid-cols-2"
            aria-label="Bill to"
          >
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
                Bill to
              </p>
              <p className="mt-1.5 text-base font-medium text-neutral-950">
                {guestName?.trim() || "Guest"}
              </p>
              {guestEmail ? (
                <p className="mt-0.5 text-sm text-neutral-600">{guestEmail}</p>
              ) : null}
              {agentName ? (
                <p className="mt-2 text-sm text-neutral-700">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Agent
                  </span>{" "}
                  {agentName}
                </p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
                Folio
              </p>
              <p className="mt-1.5 text-sm font-medium text-neutral-900">
                {folioLabel ?? "—"}
              </p>
              {bookingId ? (
                <p className="mt-0.5 font-mono text-xs text-neutral-500">
                  Booking {bookingId.slice(0, 8)}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {/* Stay summary — hotel tax-invoice identity (not POS slip) */}
        {hasStaySummary ? (
          <section
            className="fiscal-invoice-stay mt-5 border-b border-neutral-200 pb-5"
            aria-label="Stay summary"
          >
            <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
              Stay summary
            </p>
            <dl className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {checkIn ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Check-in
                  </dt>
                  <dd className="text-sm tabular-nums text-neutral-900 sm:mt-0.5">
                    {fmtHotelDate(checkIn)}
                  </dd>
                </div>
              ) : null}
              {checkOut ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Check-out
                  </dt>
                  <dd className="text-sm tabular-nums text-neutral-900 sm:mt-0.5">
                    {fmtHotelDate(checkOut)}
                  </dd>
                </div>
              ) : null}
              {stayNights != null ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Total nights
                  </dt>
                  <dd className="text-sm tabular-nums text-neutral-900 sm:mt-0.5">
                    {stayNights} {stayNights === 1 ? "night" : "nights"}
                  </dd>
                </div>
              ) : null}
              {agentName ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Travel agent
                  </dt>
                  <dd className="text-sm text-neutral-900 sm:mt-0.5">
                    {agentName}
                  </dd>
                </div>
              ) : null}
              {roomProductLines.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Room product
                  </dt>
                  <dd className="mt-0.5 space-y-0.5 text-sm text-neutral-900">
                    {roomProductLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </dd>
                </div>
              ) : bookingRoomsCount != null ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Rooms
                  </dt>
                  <dd className="text-sm tabular-nums text-neutral-900 sm:mt-0.5">
                    {bookingRoomsCount}
                  </dd>
                </div>
              ) : null}
              {roomUnitLabels.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Assigned rooms
                  </dt>
                  <dd className="mt-0.5 text-sm text-neutral-900">
                    {roomUnitLabels.join(", ")}
                  </dd>
                </div>
              ) : null}
              {mealPlanCode ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Meal plan
                  </dt>
                  <dd className="text-sm text-neutral-900 sm:mt-0.5">
                    {mealPlanCode}
                    {mealPlanAmountBtn != null
                      ? ` · ${formatBtn(mealPlanAmountBtn)} / day`
                      : null}
                  </dd>
                </div>
              ) : null}
              {quotedTotalBtn != null ? (
                <div className="flex items-baseline justify-between gap-4 sm:block">
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    Quoted stay
                  </dt>
                  <dd className="font-mono text-sm tabular-nums text-neutral-900 sm:mt-0.5">
                    {formatBtn(quotedTotalBtn)}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="fiscal-invoice-stay-note mt-3 text-[11px] leading-relaxed text-neutral-500">
              Posted room and package charges appear in the lines below. Stay
              figures above identify the booking period and inventory only.
            </p>
          </section>
        ) : null}

        {/* Line items */}
        <table className="fiscal-invoice-lines mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-900">
              <th
                scope="col"
                className="py-2.5 pr-3 text-left text-[10px] font-semibold tracking-[0.16em] text-neutral-600 uppercase"
              >
                Description
              </th>
              <th
                scope="col"
                className="w-[7.5rem] py-2.5 pl-2 text-right text-[10px] font-semibold tracking-[0.16em] text-neutral-600 uppercase"
              >
                GST
              </th>
              <th
                scope="col"
                className="w-[8.5rem] py-2.5 pl-2 text-right text-[10px] font-semibold tracking-[0.16em] text-neutral-600 uppercase"
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-sm text-neutral-500"
                >
                  No posted charge lines on this folio.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-200 last:border-neutral-300"
                >
                  <td className="py-2.5 pr-3 align-top text-neutral-900">
                    {line.description}
                  </td>
                  <td className="py-2.5 pl-2 text-right align-top font-mono text-[13px] tabular-nums text-neutral-700">
                    {formatBtn(Number(line.gst_btn))}
                  </td>
                  <td className="py-2.5 pl-2 text-right align-top font-mono text-[13px] tabular-nums text-neutral-900">
                    {formatBtn(Number(line.total_btn))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals hierarchy */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-[16rem] space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-6 text-neutral-600">
              <span>Subtotal (excl. GST)</span>
              <span className="font-mono tabular-nums text-neutral-800">
                {formatBtn(netBtn)}
              </span>
            </div>
            {gstBtn !== 0 ? (
              <div className="flex items-baseline justify-between gap-6 text-neutral-600">
                <span>GST</span>
                <span className="font-mono tabular-nums text-neutral-800">
                  {formatBtn(gstBtn)}
                </span>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between gap-6 border-t-2 border-neutral-900 pt-2.5">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-neutral-950 uppercase">
                Total due
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-neutral-950">
                {formatBtn(totalBtn)}
              </span>
            </div>
            <p className="text-right text-[11px] text-neutral-500">
              Amounts in BTN · GST exclusive-add
            </p>
          </div>
        </div>

        {memo ? (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase">
              Notes
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
              {memo}
            </p>
          </div>
        ) : null}

        <footer className="mt-10 space-y-1.5 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-500">
          <p>
            This is a computer-generated tax document. No signature is required
            when issued under the property’s authorised fiscal sequence.
          </p>
          <p>
            Document numbers are gapless per property via{" "}
            <span className="font-mono text-neutral-600">property_sequences</span>
            . Retain this copy for GST and guest records. Use Print → Save as
            PDF for archival filing.
          </p>
          <p className="pt-1 text-neutral-400">
            Thank you for staying with {hotelName}.
          </p>
        </footer>
      </article>
    </div>
  );
}
