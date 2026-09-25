import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import {
  FiscalDocFooter,
  FiscalLetterhead,
  FiscalLinesTable,
  FiscalParties,
  FiscalSignOff,
  FiscalStayStrip,
  FiscalTotalsBlock,
  type FiscalLineRow,
} from "@/components/erp/print/FiscalLetterhead";
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
  const netSubtotal = roundBtn(Math.max(0, totalBtn - gstBtn));
  const fiscalLines: FiscalLineRow[] = onBill.map((line) => ({
    id: line.id,
    description: line.description,
    hint:
      classifyBillLine(line) === "fnb"
        ? "F&B"
        : classifyBillLine(line) === "room"
          ? "Room"
          : null,
    qty: 1,
    rate: Number(line.total_btn),
    amount: Number(line.total_btn),
    foc: Number(line.total_btn) === 0,
  }));

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

  void stayBits;
  void logoSrc;
  void roomSub;
  void fnbSub;
  void otherSub;
  void hotelAdjSub;
  void hotelAdjShown;
  void SectionTable;
  void BILL_KIND_TITLES;
  void kindTitle;

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
        className="fiscal-invoice-sheet doc-print-sheet mx-auto max-w-[210mm] border border-[#d8d0c6] bg-white px-[12mm] py-[10mm] text-[#1a1410] shadow-sm print:border-0 print:px-0 print:py-0 print:shadow-none"
        aria-label={`${kindLabel} ${doc.doc_no as string}`}
      >
        <FiscalLetterhead
          property={{
            name: hotelName,
            legal_name: legalName,
            address: property?.address,
            phone: property?.phone,
            email: property?.email,
            tax_id: property?.tax_id,
            logo_public_id: property?.logo_public_id,
            tagline: legalName && legalName !== hotelName ? legalName : null,
          }}
          kind={
            kind === "receipt"
              ? "Receipt"
              : kind === "credit_note"
                ? "Credit note"
                : "Tax invoice"
          }
          title={
            kind === "receipt"
              ? "RECEIPT"
              : kind === "credit_note"
                ? "CREDIT NOTE"
                : bill === "fnb"
                  ? "BILL"
                  : "INVOICE"
          }
          meta={[
            { label: "Date", value: issueDate },
            { label: "Inv no.", value: String(doc.doc_no) },
            ...(roomUnitLabels.length
              ? [{ label: "Room", value: roomUnitLabels.join(", ") }]
              : []),
            ...(stayNights != null
              ? [
                  {
                    label: "Nights",
                    value: String(stayNights),
                  },
                ]
              : []),
            { label: "Currency", value: "Nu (BTN)" },
            ...(folioLabel ? [{ label: "Folio", value: folioLabel }] : []),
          ]}
        />

        <FiscalParties
          billTo={guestName?.trim() || agentName || "Guest"}
          billToDetail={
            <>
              {guestEmail ? <p>{guestEmail}</p> : null}
              {agentName && guestName ? <p>Agent: {agentName}</p> : null}
              {!bookingId && agentName ? (
                <p className="mt-1 text-[11px] text-[#5c534c]">
                  F&amp;B open item — payment due, not a stay
                </p>
              ) : null}
            </>
          }
          from={hotelName}
          fromDetail={
            property?.address ? <p>{property.address}</p> : undefined
          }
        />

        <FiscalStayStrip
          items={[
            ...(checkIn && checkOut
              ? [
                  {
                    label: "Stay",
                    value: `${fmtHotelDate(checkIn)} → ${fmtHotelDate(checkOut)}`,
                  },
                ]
              : []),
            ...(roomUnitLabels.length || roomProductLines.length
              ? [
                  {
                    label: "Rooms",
                    value:
                      roomUnitLabels.join(", ") ||
                      roomProductLines.join("; "),
                  },
                ]
              : []),
            ...(agentName
              ? [{ label: "Agent", value: agentName }]
              : []),
          ]}
        />

        {fiscalLines.length > 0 ? (
          <FiscalLinesTable rows={fiscalLines} />
        ) : (
          <p className="mt-6 text-center text-sm text-[#5c534c]">
            No posted charge lines for this bill.
          </p>
        )}

        <FiscalTotalsBlock
          subtotal={netSubtotal}
          serviceCharge={0}
          gst={gstBtn}
          total={totalBtn}
          serviceChargeRatePct={
            Number(property?.service_charge_rate ?? 0) > 0
              ? Number(property?.service_charge_rate) * 100
              : 10
          }
        />

        {memo ? (
          <div className="notes mt-2 text-[11px] text-[#3a322c]">
            <p className="font-semibold">Notes</p>
            <p className="mt-0.5">{memo}</p>
          </div>
        ) : (
          <div className="notes mt-2 text-[11px] text-[#3a322c]">
            <ul className="mt-0.5 list-disc pl-4">
              <li>
                Service charge and GST shown as Nil when not separately charged
                on this bill.
              </li>
              <li>Guest totals whole Nu ending 0 or 5 (hotel absorbs remainder).</li>
            </ul>
          </div>
        )}

        <FiscalSignOff hotelName={hotelName} />
        <FiscalDocFooter property={{ name: hotelName, address: property?.address }} />
      </article>
    </div>
  );
}
