import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  BILL_KIND_LABELS,
  BILL_KIND_TITLES,
  type BillKind,
  classifyBillLine,
  lineBelongsOnBill,
  parseBillKind,
} from "@/lib/folio/bill-kinds";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import {
  formatGuestBtn,
  isGuestRateAdjDescription,
  roundBtn,
} from "@/lib/pricing";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { nightsBetween } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Tax invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bill?: string }>;
};

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

function fmtHotelDate(iso: string): string {
  const raw = String(iso).trim();
  if (!raw) return "—";
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

function sumLines(rows: FolioLine[]): number {
  return roundBtn(rows.reduce((s, l) => s + Number(l.total_btn ?? 0), 0));
}

function sumGst(rows: FolioLine[]): number {
  return roundBtn(rows.reduce((s, l) => s + Number(l.gst_btn ?? 0), 0));
}

/** Printable fiscal invoice — Master / Room / F&B bills; totals whole Nu 0 or 5. */
export default async function FiscalInvoicePrintPage({
  params,
  searchParams,
}: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { id } = await params;
  const sp = await searchParams;
  const bill: BillKind = parseBillKind(sp.bill);
  const admin = createSupabaseAdminClient();
  const activePropertyId = await resolveActivePropertyId(admin);

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
          "label, booking_id, agent_id, folio_type, agents(company_name, contact_email, contact_name), folio_lines(id, description, total_btn, gst_btn, status, source_type, reverses_line_id)",
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

  const bookingId = folio?.booking_id as string | null | undefined;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select(
        `contact_email, contact_name, check_in, check_out, rooms,
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
    }
  } else {
    const agentRaw = (
      folio as {
        agents?: MaybeList<{
          company_name?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
        }>;
      } | null
    )?.agents;
    const agent = firstOf(agentRaw ?? null);
    agentName = agent?.company_name?.trim() || null;
    guestName = agentName;
    guestEmail = agent?.contact_email?.trim() || null;
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

  const onBill = lines.filter((l) => lineBelongsOnBill(l, bill));

  const roomLines = onBill.filter((l) => classifyBillLine(l) === "room");
  const fnbLines = onBill.filter((l) => classifyBillLine(l) === "fnb");
  const hotelAdjLines = onBill.filter(
    (l) => classifyBillLine(l) === "hotel_adj",
  );
  const otherLines = onBill.filter((l) => classifyBillLine(l) === "other");

  // Stream rate adj counted with their bill when not master-only hotel_adj
  const streamAdjRoom = onBill.filter(
    (l) =>
      isGuestRateAdjDescription(l.description) &&
      (l.description ?? "").toLowerCase().includes("room bill"),
  );
  const streamAdjFnb = onBill.filter(
    (l) =>
      isGuestRateAdjDescription(l.description) &&
      ((l.description ?? "").toLowerCase().includes("f&b") ||
        (l.description ?? "").toLowerCase().includes("fnb")),
  );

  const roomSub = sumLines([...roomLines, ...streamAdjRoom]);
  const fnbSub = sumLines([...fnbLines, ...streamAdjFnb]);
  const hotelAdjShown =
    bill === "master"
      ? hotelAdjLines.filter(
          (l) =>
            !streamAdjRoom.some((a) => a.id === l.id) &&
            !streamAdjFnb.some((a) => a.id === l.id),
        )
      : [];
  const hotelAdjSub = sumLines(hotelAdjShown);
  const otherSub = sumLines(otherLines);
  const totalBtn = sumLines(onBill);
  const gstBtn = sumGst(onBill);

  const kind = doc.doc_kind as string;
  const kindLabel =
    kind === "receipt"
      ? "Receipt"
      : kind === "credit_note"
        ? "Credit note"
        : BILL_KIND_LABELS[bill];
  const kindTitle =
    kind === "receipt"
      ? "RECEIPT"
      : kind === "credit_note"
        ? "CREDIT NOTE"
        : BILL_KIND_TITLES[bill];

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
    ? cloudinaryUrl(property.logo_public_id, { width: 160, crop: "fit" })
    : null;
  const issueDate = fmtHotelDate(String(doc.issued_at));
  const folioLabel = (folio?.label as string | null) ?? null;

  const stayBits = [
    checkIn && checkOut
      ? `${fmtHotelDate(checkIn)} → ${fmtHotelDate(checkOut)}`
      : checkIn
        ? `In ${fmtHotelDate(checkIn)}`
        : null,
    stayNights != null
      ? `${stayNights} ${stayNights === 1 ? "night" : "nights"}`
      : null,
    roomUnitLabels.length
      ? `Rm ${roomUnitLabels.join(", ")}`
      : roomProductLines[0] ?? null,
    agentName ? `Agent ${agentName}` : null,
  ].filter(Boolean);

  function SectionTable({
    title,
    rows,
    subtotalLabel,
    subtotal,
  }: {
    title: string;
    rows: FolioLine[];
    subtotalLabel: string;
    subtotal: number;
  }) {
    if (rows.length === 0) return null;
    return (
      <section className="mt-4">
        <p className="border-b border-neutral-900 pb-1 text-[10px] font-semibold tracking-[0.16em] text-neutral-700 uppercase">
          {title}
        </p>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {rows.map((line) => (
              <tr
                key={line.id}
                className="border-b border-neutral-150 border-neutral-200/80"
              >
                <td className="py-1.5 pr-2 align-top text-neutral-900">
                  {line.description}
                  {Number(line.gst_btn) > 0.009 ? (
                    <span className="mt-0.5 block text-[11px] text-neutral-500">
                      incl. GST {formatGuestBtn(Number(line.gst_btn))}
                    </span>
                  ) : null}
                </td>
                <td className="w-[6.5rem] py-1.5 pl-2 text-right align-top font-mono tabular-nums text-neutral-900">
                  {formatGuestBtn(Number(line.total_btn))}
                </td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 pr-2 text-right text-[12px] font-medium text-neutral-700">
                {subtotalLabel}
              </td>
              <td className="pt-2 pl-2 text-right font-mono text-[13px] font-semibold tabular-nums text-neutral-950">
                {formatGuestBtn(subtotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  }

  const basePrintHref = `/erp/invoices/${id}/print`;
  const billLinks: { kind: BillKind; label: string }[] = [
    { kind: "master", label: "Master bill" },
    { kind: "room", label: "Room bill" },
    { kind: "fnb", label: "F&B bill" },
  ];

  return (
    <div className="erp mx-auto max-w-[820px] space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            {kindLabel} print
          </p>
          <h1 className="mt-1 font-mono text-xl font-semibold text-foreground">
            {doc.doc_no as string}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Process: Master bill → Room bill → F&amp;B bill · guest totals whole
            Nu ending 0 or 5
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {folioId ? (
            <a
              href={`/erp/folios/${folioId}`}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
            >
              Back to folio
            </a>
          ) : null}
          <a
            href="/erp/invoices"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
          >
            All invoices
          </a>
          <DocPrintControls defaultSize="a4" printLabel="Print / PDF" />
        </div>
      </div>

      {kind === "invoice" || kind === "receipt" ? (
        <div className="print:hidden flex flex-wrap gap-2">
          {billLinks.map((b) => (
            <a
              key={b.kind}
              href={`${basePrintHref}?bill=${b.kind}`}
              className={
                bill === b.kind
                  ? "inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background"
                  : "inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
              }
            >
              {b.label}
            </a>
          ))}
        </div>
      ) : null}

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
        className="fiscal-invoice-sheet doc-print-sheet mx-auto max-w-[640px] border border-neutral-300 bg-white px-6 py-6 text-neutral-900 shadow-sm print:border-0 print:px-0 print:py-0 print:shadow-none"
        aria-label={`${kindLabel} ${doc.doc_no as string}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-900 pb-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
              {hotelName}
            </h1>
            {legalName && legalName !== hotelName ? (
              <p className="text-[12px] text-neutral-600">{legalName}</p>
            ) : null}
            <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-neutral-600">
              {property?.address ? <p>{property.address}</p> : null}
              <p className="flex flex-wrap gap-x-2">
                {property?.phone ? <span>T {property.phone}</span> : null}
                {property?.tax_id ? (
                  <span className="font-mono">TPN {property.tax_id}</span>
                ) : null}
              </p>
            </div>
          </div>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt=""
              className="h-12 w-auto shrink-0 object-contain"
            />
          ) : null}
        </header>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
              {kindTitle}
            </p>
            <p className="font-mono text-base font-semibold tabular-nums">
              {doc.doc_no as string}
            </p>
          </div>
          <div className="text-right text-[12px] text-neutral-700">
            <p>
              <span className="text-neutral-500">Date </span>
              {issueDate}
            </p>
            {folioLabel ? <p className="text-neutral-600">{folioLabel}</p> : null}
          </div>
        </div>

        <div className="mt-3 grid gap-1 border-b border-neutral-200 pb-3 text-[13px] sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
              Bill to
            </p>
            <p className="font-medium text-neutral-950">
              {guestName?.trim() || agentName || "Guest"}
            </p>
            {guestEmail ? (
              <p className="text-[12px] text-neutral-600">{guestEmail}</p>
            ) : null}
            {!bookingId && agentName ? (
              <p className="mt-1 text-[11px] text-neutral-500">
                F&amp;B open item — payment due, not a stay
              </p>
            ) : null}
          </div>
          {stayBits.length > 0 ? (
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                Stay
              </p>
              <p className="text-[12px] leading-snug text-neutral-800">
                {stayBits.join(" · ")}
              </p>
            </div>
          ) : null}
        </div>

        {(bill === "master" || bill === "room") && (
          <SectionTable
            title="Room charges"
            rows={[...roomLines, ...streamAdjRoom]}
            subtotalLabel="Room bill subtotal"
            subtotal={roomSub}
          />
        )}
        {(bill === "master" || bill === "fnb") && (
          <SectionTable
            title="Food & beverage"
            rows={[...fnbLines, ...streamAdjFnb]}
            subtotalLabel="F&B bill subtotal"
            subtotal={fnbSub}
          />
        )}
        {bill === "master" ? (
          <SectionTable
            title="Other charges"
            rows={otherLines}
            subtotalLabel="Other subtotal"
            subtotal={otherSub}
          />
        ) : null}

        {hotelAdjShown.length > 0 ? (
          <section className="mt-4">
            <p className="border-b border-neutral-900 pb-1 text-[10px] font-semibold tracking-[0.16em] text-neutral-700 uppercase">
              Hotel adjustment (not charged to guest)
            </p>
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              Rounding to whole Nu ending in 0 or 5 is absorbed from hotel rates
              — guest is not billed the difference.
            </p>
            <table className="mt-1 w-full border-collapse text-[13px]">
              <tbody>
                {hotelAdjShown.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-neutral-200/80"
                  >
                    <td className="py-1.5 pr-2 align-top text-neutral-800">
                      {line.description}
                    </td>
                    <td className="w-[6.5rem] py-1.5 pl-2 text-right align-top font-mono tabular-nums text-neutral-800">
                      {formatGuestBtn(Number(line.total_btn))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2 pr-2 text-right text-[12px] font-medium text-neutral-700">
                    Hotel adj subtotal
                  </td>
                  <td className="pt-2 pl-2 text-right font-mono text-[13px] font-semibold tabular-nums">
                    {formatGuestBtn(hotelAdjSub)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        {onBill.length === 0 ? (
          <p className="mt-6 text-center text-sm text-neutral-500">
            No posted charge lines for this bill.
          </p>
        ) : null}

        <div className="mt-5 border-t-2 border-neutral-900 pt-3">
          <div className="ml-auto w-full max-w-[15rem] space-y-1 text-[13px]">
            {gstBtn !== 0 ? (
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>GST included in lines</span>
                <span className="font-mono tabular-nums">
                  {formatGuestBtn(gstBtn)}
                </span>
              </div>
            ) : null}
            {bill === "master" && roomLines.length + streamAdjRoom.length > 0 ? (
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>Room bill</span>
                <span className="font-mono tabular-nums">
                  {formatGuestBtn(roomSub)}
                </span>
              </div>
            ) : null}
            {bill === "master" && fnbLines.length + streamAdjFnb.length > 0 ? (
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>F&amp;B bill</span>
                <span className="font-mono tabular-nums">
                  {formatGuestBtn(fnbSub)}
                </span>
              </div>
            ) : null}
            {hotelAdjShown.length > 0 ? (
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>Hotel adj</span>
                <span className="font-mono tabular-nums">
                  {formatGuestBtn(hotelAdjSub)}
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-neutral-400 pt-2">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-neutral-950 uppercase">
                {bill === "master"
                  ? "Master total"
                  : bill === "room"
                    ? "Room bill total"
                    : "F&B bill total"}
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-neutral-950">
                {formatGuestBtn(totalBtn)}
              </span>
            </div>
            <p className="text-right text-[10px] text-neutral-500">
              BTN · whole Nu · ends on 0 or 5 (hotel absorbs remainder)
            </p>
          </div>
        </div>

        {memo ? (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
              Notes
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-700">
              {memo}
            </p>
          </div>
        ) : null}

        <footer className="mt-6 space-y-1 border-t border-neutral-200 pt-3 text-[10px] leading-relaxed text-neutral-500">
          <p>
            Computer-generated tax document. Gapless document no. per property.
            Print → Save as PDF for records.
          </p>
          <p className="text-neutral-400">Thank you for staying with {hotelName}.</p>
        </footer>
      </article>
    </div>
  );
}
