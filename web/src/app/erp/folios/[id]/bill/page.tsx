import { DocPrintControls } from "@/components/erp/DocPrintControls";
import {
  FiscalLetterhead,
  FiscalLinesTable,
  FiscalPayBlock,
  FiscalTotalsBlock,
  type FiscalLineRow,
} from "@/components/erp/print/FiscalLetterhead";
import { FolioPreviewFit } from "@/components/erp/print/FolioPreviewFit";
import { RoomBillTable } from "@/components/erp/print/RoomBillTable";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  BILL_KIND_LABELS,
  BILL_KIND_TITLES,
  classifyBillLine,
  lineBelongsOnBill,
  parseBillKind,
  type BillKind,
} from "@/lib/folio/bill-kinds";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { buildRoomBillRows, roomBillTotal } from "@/lib/folio/room-bill";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { folioNoFromConfirmation } from "@/lib/hotel-doc-no";
import { buildDynamicEmv } from "@/lib/bank-qr/emv";
import { amountInWordsNu } from "@/lib/print/amount-in-words";
import { formatGuestBtn, roundBtn } from "@/lib/pricing";
import QRCode from "qrcode";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Bill",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bill?: string }>;
};

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function splitGuideLabel(raw: string | null): { name: string; phone: string } {
  const text = (raw ?? "").trim();
  const match = text.match(/^(.*?)(?:\s+)(\d{6,})$/);
  if (!match) return { name: text, phone: "" };
  return { name: match[1].trim(), phone: match[2] };
}

function foodLineTitle(description: string | null | undefined): string {
  return (description ?? "F&B")
    .replace(/\s*·\s*guest pays later, not the agent\s*/gi, "")
    .replace(/\s*·\s*agent tab\s*/gi, "")
    .replace(/^Desk\s+[^:]+:\s*/i, "")
    .trim() || "F&B";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function FolioBillPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const bill: BillKind = parseBillKind((await searchParams).bill);
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: folio } = await admin
    .from("folios")
    .select(
      `id, property_id, label, booking_id,
       folio_lines(id, description, qty, unit_price_btn, total_btn, gst_btn, service_charge_btn, status, source_type, source_id, reverses_line_id)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!folio) notFound();
  try {
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
  } catch {
    notFound();
  }

  const bookingId = (folio.booking_id as string | null) ?? null;
  let guestName = (folio.label as string | null)?.trim() || "Guest";
  let agentName: string | null = null;
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  let mealPlanCode: string | null = null;
  let guideNumber: string | null = null;
  let guideName = "";
  let guidePhone = "";
  let adults = 0;
  let children = 0;
  let nationalities: string[] = [];
  let confirmation: string | null = null;
  const roomLines: Array<{
    roomTypeName: string;
    roomNumbers: string[];
    rooms: number;
    nightlyRateBtn: number | null;
    occupancy: string | null;
    postedAmountBtn: number | null;
  }> = [];

  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select(
        `contact_name, confirmation_code, check_in, check_out, adults, children,
         meal_plan_code, guide_number, agreed_nightly_rate_btn,
         agents(company_name),
         guides(full_name, phone, guide_number),
         booking_guests(nationality),
         booking_rooms(qty, occupancy, agreed_nightly_rate_btn, inventory_kind, room_type_id, room_types(id, name, code)),
         room_assignments(room_units(label, room_type_id))`,
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (booking) {
      guestName = (booking.contact_name as string | null)?.trim() || guestName;
      confirmation = (booking.confirmation_code as string | null) ?? null;
      checkIn = (booking.check_in as string | null) ?? null;
      checkOut = (booking.check_out as string | null) ?? null;
      mealPlanCode = (booking.meal_plan_code as string | null) ?? null;
      guideNumber = (booking.guide_number as string | null) ?? null;
      const guide = one(
        booking.guides as
          | { full_name?: string | null; phone?: string | null; guide_number?: string | null }
          | { full_name?: string | null; phone?: string | null; guide_number?: string | null }[]
          | null,
      );
      const guideBits = splitGuideLabel(guideNumber);
      guideName = guide?.full_name?.trim() || guideBits.name;
      guidePhone = guide?.phone?.trim() || guideBits.phone;
      if (!guideNumber && guide?.guide_number) guideNumber = guide.guide_number;
      adults = Number(booking.adults ?? 0);
      children = Math.max(0, Number(booking.children ?? 0));
      agentName =
        one(booking.agents as { company_name?: string | null } | { company_name?: string | null }[] | null)
          ?.company_name?.trim() || null;
      nationalities = (
        (booking.booking_guests as Array<{ nationality?: string | null }> | null) ?? []
      )
        .map((guest) => (guest.nationality ?? "").trim())
        .filter(Boolean);
      const agreed =
        booking.agreed_nightly_rate_btn != null
          ? Number(booking.agreed_nightly_rate_btn)
          : null;
      const labelsByType = new Map<string, string[]>();
      for (const row of (booking.room_assignments as Array<{
        room_units?: { label?: string | null; room_type_id?: string | null } | { label?: string | null; room_type_id?: string | null }[] | null;
      }> | null) ?? []) {
        const unit = one(row.room_units);
        const typeId = unit?.room_type_id;
        const label = unit?.label?.trim();
        if (!typeId || !label) continue;
        const list = labelsByType.get(typeId) ?? [];
        if (!list.includes(label)) list.push(label);
        labelsByType.set(typeId, list);
      }
      for (const row of (booking.booking_rooms as Array<{
        qty?: number | null;
        occupancy?: string | null;
        agreed_nightly_rate_btn?: number | null;
        inventory_kind?: string | null;
        room_type_id?: string | null;
        room_types?: { id?: string; name?: string | null; code?: string | null } | { id?: string; name?: string | null; code?: string | null }[] | null;
      }> | null) ?? []) {
        if (row.inventory_kind && row.inventory_kind !== "sellable_guest") continue;
        const type = one(row.room_types);
        const typeId = row.room_type_id || type?.id || "";
        roomLines.push({
          roomTypeName: type?.name?.trim() || type?.code?.trim() || "Room",
          roomNumbers: typeId ? (labelsByType.get(typeId) ?? []) : [],
          rooms: Math.max(1, Number(row.qty) || 1),
          nightlyRateBtn:
            row.agreed_nightly_rate_btn != null
              ? Number(row.agreed_nightly_rate_btn)
              : agreed,
          occupancy: row.occupancy ?? null,
          postedAmountBtn: null,
        });
      }
    }
  }

  const visible = guestVisibleBalanceLines(
    ((folio.folio_lines as Array<{
      id: string;
      description?: string | null;
      qty?: number | null;
      unit_price_btn?: number | null;
      total_btn: number;
      gst_btn?: number | null;
      service_charge_btn?: number | null;
      status: string;
      source_type?: string | null;
      source_id?: string | null;
      reverses_line_id?: string | null;
    }> | null) ?? []).map((line) => ({
      ...line,
      total_btn: Number(line.total_btn),
    })),
  ).filter((line) => {
    const source = (line.source_type ?? "").toLowerCase();
    return source !== "payment" && source !== "deposit";
  });

  const charges = visible.filter((line) =>
    lineBelongsOnBill(
      { source_type: line.source_type ?? "", description: line.description },
      bill,
    ),
  );
  const chargeTotal = charges.reduce((sum, line) => sum + Number(line.total_btn), 0);

  if (bill === "room") {
    const postedRoom = charges.filter(
      (line) => classifyBillLine({ source_type: line.source_type ?? "", description: line.description }) === "room",
    );
    for (const line of roomLines) {
      const posted = postedRoom.filter((charge) =>
        line.roomNumbers.some((label) => (charge.description ?? "").includes(label)),
      );
      line.postedAmountBtn =
        line.roomNumbers.length > 0 && posted.length > 0
          ? posted.reduce((sum, charge) => sum + Number(charge.total_btn), 0)
          : null;
    }
  }

  const roomRows =
    bill === "room"
      ? buildRoomBillRows({
          checkIn: checkIn ?? "",
          checkOut: checkOut ?? "",
          mealPlanCode,
          adults,
          children,
          nationalities,
          guideNumber,
          descriptionScope: "room",
          lines: roomLines,
        })
      : [];
  const fnbService =
    bill === "fnb"
      ? roundBtn(
          charges.reduce(
            (sum, line) => sum + Number(line.service_charge_btn ?? 0),
            0,
          ),
        )
      : 0;
  const fnbGst =
    bill === "fnb"
      ? roundBtn(
          charges.reduce((sum, line) => sum + Number(line.gst_btn ?? 0), 0),
        )
      : 0;
  const orderIds = [
    ...new Set(
      charges
        .filter((line) => {
          const source = (line.source_type ?? "").toLowerCase();
          return (source === "order" || source === "pos") && line.source_id;
        })
        .map((line) => line.source_id as string),
    ),
  ];
  const itemsByOrder = new Map<
    string,
    { name: string; qty: number; rate: number }[]
  >();
  if (bill === "fnb" && orderIds.length > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("id, order_items(name_snapshot, qty, unit_price_btn, voided_at)")
      .in("id", orderIds);
    for (const order of orders ?? []) {
      const items = (
        (order.order_items as
          | {
              name_snapshot?: string | null;
              qty?: number | null;
              unit_price_btn?: number | null;
              voided_at?: string | null;
            }[]
          | null) ?? []
      ).filter((item) => !item.voided_at);
      itemsByOrder.set(
        order.id as string,
        items.map((item) => ({
          name: item.name_snapshot?.trim() || "Item",
          qty: Math.max(1, Number(item.qty) || 1),
          rate: Number(item.unit_price_btn) || 0,
        })),
      );
    }
  }
  const fnbRows: FiscalLineRow[] = [];
  if (bill === "fnb") {
    const seenOrders = new Set<string>();
    for (const line of charges) {
      const source = (line.source_type ?? "").toLowerCase();
      const orderId =
        (source === "order" || source === "pos") && line.source_id
          ? line.source_id
          : null;
      if (orderId && seenOrders.has(orderId)) continue;
      if (orderId) seenOrders.add(orderId);
      const items = orderId ? (itemsByOrder.get(orderId) ?? []) : [];
      if (items.length > 0) {
        for (const item of items) {
          fnbRows.push({
            id: `${orderId}-${fnbRows.length}`,
            description: item.name,
            qty: item.qty,
            rate: item.rate,
            amount: roundBtn(item.qty * item.rate),
          });
        }
        continue;
      }
      const qty = Math.max(1, Number(line.qty) || 1);
      const total = Number(line.total_btn);
      const rate =
        line.unit_price_btn != null
          ? Number(line.unit_price_btn)
          : roundBtn(total / qty);
      fnbRows.push({
        id: line.id,
        description: foodLineTitle(line.description),
        qty,
        rate,
        amount: total,
        gst: line.gst_btn == null ? null : Number(line.gst_btn),
        sc:
          line.service_charge_btn == null
            ? null
            : Number(line.service_charge_btn),
      });
    }
  }

  const property = await loadProperty(admin, propertyId);
  const hotelName = property?.name?.trim() || "Hotel";
  const heading = BILL_KIND_LABELS[bill];
  const folioNo = folioNoFromConfirmation(confirmation);
  const backHref = stayFolioHref(bookingId, id);
  const paperTotal = bill === "room" ? roomBillTotal(roomRows) : chargeTotal;
  const banks = property?.bank_accounts ?? [];
  const bank = banks.find((row) => row.qr_payload || row.qr_url || row.account);
  let bankQr: string | null = bank?.qr_url?.trim() || null;
  const staticPayload = bank?.qr_payload?.trim() ?? "";
  if (staticPayload && paperTotal > 0) {
    const emv = buildDynamicEmv(
      staticPayload,
      paperTotal,
      folioNo ?? confirmation ?? hotelName,
    );
    if (emv) {
      bankQr = await QRCode.toDataURL(emv, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
        color: { dark: "#1a1410", light: "#ffffff" },
      });
    }
  }
  const pax = adults + children;
  const nationLabel = nationalities.join(", ");
  const guideLine = [guideName, guidePhone].filter(Boolean).join(" · ") || "—";

  return (
    <FolioPreviewFit
      toolbar={
        <>
          <a href={backHref} className="text-sm underline-offset-4 hover:underline">
            Back to bill
          </a>
          <DocPrintControls defaultSize="a4" printLabel="Print / PDF" />
        </>
      }
    >
      <article className="folio-a4 fiscal-invoice-sheet doc-print-sheet flex w-[210mm] min-h-[297mm] flex-col bg-white px-[14mm] py-[12mm] text-[#1a1410] shadow-[0_16px_40px_rgba(26,20,16,0.16)] print:shadow-none">
        <FiscalLetterhead
          property={{
            name: hotelName,
            legal_name: property?.legal_name,
            address: property?.address,
            phone: property?.phone,
            email: property?.email,
            tax_id: property?.tax_id ?? null,
            logo_public_id: property?.logo_public_id,
          }}
          kind="Folio"
          title={folioNo ?? BILL_KIND_TITLES[bill]}
          meta={[
            { label: "Paper", value: heading },
            ...(confirmation ? [{ label: "Stay", value: confirmation }] : []),
          ]}
        />
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 border-b border-[#1a1410] pb-3 text-[12px]">
          <Fact label="Guest" value={guestName} />
          <Fact label="Agent" value={agentName || "—"} />
          <Fact label="Arrival" value={fmtDate(checkIn)} />
          <Fact label="Departure" value={fmtDate(checkOut)} />
          <Fact label="Guide" value={guideLine} />
          <Fact
            label="Party"
            value={[pax > 0 ? `${pax} pax` : null, nationLabel || null, mealPlanCode || null]
              .filter(Boolean)
              .join(" · ") || "—"}
          />
        </dl>
        {bill === "room" && roomRows.length > 0 ? (
          <RoomBillTable rows={roomRows} tone="paper" />
        ) : null}
        {bill === "room" && roomRows.length === 0 ? (
          <p className="mt-6 text-sm">No room lines on this bill yet.</p>
        ) : null}
        {bill === "master" ? (
          <table className="mt-5 w-full border-collapse text-[13px]">
            <tbody>
              <tr className="border-b border-[#e4ddd4]">
                <td className="py-2 pr-3">
                  {[guestName, confirmation, checkIn && checkOut ? `${fmtDate(checkIn)} – ${fmtDate(checkOut)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td className="w-[7rem] py-2 text-right font-semibold tabular-nums">
                  {formatGuestBtn(chargeTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}
        {bill === "fnb" && fnbRows.length > 0 ? (
          <>
            <FiscalLinesTable rows={fnbRows} layout="items" />
            <FiscalTotalsBlock
              subtotal={chargeTotal}
              serviceCharge={fnbService}
              gst={fnbGst}
              total={chargeTotal}
              summary="food"
            />
          </>
        ) : null}
        {bill === "fnb" && fnbRows.length === 0 ? (
          <p className="mt-6 text-sm">No F&B lines on this bill yet.</p>
        ) : null}
        {bill === "fnb" ? null : (
          <p className="mt-3 text-right text-[11px] text-[#3a322c]">
            {amountInWordsNu(paperTotal)} Service charge is included in the rate.
          </p>
        )}
        <FiscalPayBlock banks={banks} qrDataUrl={bankQr} prominent />
        <section className="mt-8 border-t-2 border-[#1a1410] pt-4">
          <p className="text-[13px] font-semibold">Guide to sign before payment</p>
          <p className="mt-1 max-w-[42rem] text-[12px] leading-relaxed">
            I confirm the rooms, dates, and the amount of {formatGuestBtn(paperTotal)} on this {heading.toLowerCase()} for {guestName}
            {agentName ? `, ${agentName}` : ""}. The tax invoice is given only after this amount is paid.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-12">
            <SignLine
              title="Guide signature"
              lines={[
                `Name: ${guideName || "________________________"}`,
                `Phone: ${guidePhone || "________________________"}`,
              ]}
            />
            <SignLine
              title="Front office"
              lines={["Name: ________________________", "Date: ________________________"]}
            />
          </div>
          <div className="mt-6">
            <div className="h-16 w-28 border border-dashed border-[#1a1410]" />
            <p className="mt-1 text-[11px]">Hotel stamp</p>
          </div>
        </section>
      </article>
    </FolioPreviewFit>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] text-[#5c534c]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SignLine({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <div className="h-16 border-b border-[#1a1410]" />
      <p className="mt-1 text-[12px] font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-[11px] text-[#3a322c]">
          {line}
        </p>
      ))}
    </div>
  );
}
