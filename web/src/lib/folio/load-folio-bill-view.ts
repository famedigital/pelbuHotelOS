import { buildDynamicEmv } from "@/lib/bank-qr/emv";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import {
  BILL_KIND_LABELS,
  BILL_KIND_TITLES,
  lineBelongsOnBill,
  type BillKind,
} from "@/lib/folio/bill-kinds";
import type { FolioChargeInput } from "@/lib/folio/folio-charge-rows";
import {
  buildRoomTaxInvoice,
  includedBreakfastOnFoodBill,
  receivedCoversMasterBill,
  slashDate,
  type TaxInvoiceTotals,
} from "@/lib/folio/room-tax-invoice";
import { thimphuToday } from "@/lib/erp-lists";
import {
  buildMasterBillRows,
  type MasterBillRow,
} from "@/lib/folio/master-bill-rows";
import { stayFolioHref } from "@/lib/folio/stay-hub-cycle";
import { folioNoFromConfirmation } from "@/lib/hotel-doc-no";
import { loadProperty } from "@/lib/property-context";
import type { BankAccount } from "@/lib/property-types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadBillSignatures } from "@/lib/print/bill-signature";
import { getStaffSession } from "@/lib/staff-auth";
import QRCode from "qrcode";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type FolioBillView = {
  folioId: string;
  bookingId: string | null;
  backHref: string;
  bill: BillKind;
  heading: string;
  title: string;
  confirmation: string | null;
  property: {
    name: string;
    legal_name?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    website?: string | null;
    tax_id?: string | null;
    logo_public_id?: string | null;
    tagline?: string | null;
  };
  guestName: string;
  agentName: string | null;
  /** Booking group, when this stay is on a group. Otherwise the guest name is used. */
  groupName: string | null;
  /** Who settles this folio. Guest means it stays off the agent total. */
  payerLabel: string | null;
  preparedBy: string | null;
  preparedSignature: string | null;
  signatoryName: string;
  signatorySignature: string | null;
  arrival: string;
  departure: string;
  guideLine: string;
  guideName: string;
  guidePhone: string;
  partyLine: string;
  folioNo: string;
  taxId: string | null;
  issueDate: string;
  roomsLabel: string;
  guestCountLabel: string;
  mealPlanCode: string | null;
  identityNo: string;
  identityType: string;
  serviceChargeRate: number;
  gstRate: number;
  invoice: TaxInvoiceTotals;
  masterRows: MasterBillRow[] | null;
  charges: FolioChargeInput[];
  paperTotal: number;
  /** Posted charges on this folio, all-in. */
  masterTotal: number;
  /** Confirmed payments, or payment lines when no payment row exists. */
  receivedTotal: number;
  taxInvoiceNo: string | null;
  receiptNo: string | null;
  /** Master bill is covered and at least one of the pair is still missing. */
  canIssueTaxPair: boolean;
  banks: BankAccount[];
  bankQr: string | null;
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

function identityKind(ids: string[]): string {
  const kinds = new Set(
    ids.map((value) => (/^\d{11}$/.test(value) ? "CID" : "Passport")),
  );
  if (kinds.size === 0) return "—";
  return [...kinds].join(", ");
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

export async function loadFolioBillView(
  admin: Admin,
  propertyId: string,
  folioId: string,
  bill: BillKind,
): Promise<FolioBillView | null> {
  const { data: folio } = await admin
    .from("folios")
    .select(
      `id, property_id, label, doc_no, booking_id,
       folio_lines(id, description, qty, unit_price_btn, amount_btn, service_charge_btn, gst_btn, total_btn, status, source_type, reverses_line_id, business_date, bill_to)`,
    )
    .eq("id", folioId)
    .maybeSingle();
  if (!folio) return null;
  try {
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
  } catch {
    return null;
  }

  const bookingId = (folio.booking_id as string | null) ?? null;
  let guestName = (folio.label as string | null)?.trim() || "Guest";
  let agentName: string | null = null;
  let groupName: string | null = null;
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  let mealPlanCode: string | null = null;
  let guideName = "";
  let guidePhone = "";
  let adults = 0;
  let children = 0;
  let nationalities: string[] = [];
  let identityNos: string[] = [];
  let confirmation: string | null = null;
  const roomTypeByNumber: Record<string, string> = {};
  const assignedRooms: string[] = [];

  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select(
        `contact_name, confirmation_code, check_in, check_out, adults, children,
         meal_plan_code, guide_number,
         agents(company_name),
         guides(full_name, phone, guide_number),
         booking_guests(nationality, passport_or_cid),
         room_assignments(room_units(label, room_types(name)))`,
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (booking) {
      guestName = (booking.contact_name as string | null)?.trim() || guestName;
      const { data: memberships } = await admin
        .from("booking_group_members")
        .select("booking_groups(name)")
        .eq("booking_id", bookingId)
        .limit(1);
      const membership = (memberships?.[0] ?? null) as {
        booking_groups?: { name?: string | null } | { name?: string | null }[] | null;
      } | null;
      groupName =
        (one(membership?.booking_groups ?? null)?.name ?? "").trim() || null;
      confirmation = (booking.confirmation_code as string | null) ?? null;
      checkIn = (booking.check_in as string | null) ?? null;
      checkOut = (booking.check_out as string | null) ?? null;
      mealPlanCode = (booking.meal_plan_code as string | null) ?? null;
      const guideNumber = (booking.guide_number as string | null) ?? null;
      const guide = one(
        booking.guides as
          | { full_name?: string | null; phone?: string | null; guide_number?: string | null }
          | { full_name?: string | null; phone?: string | null; guide_number?: string | null }[]
          | null,
      );
      const guideBits = splitGuideLabel(guideNumber);
      guideName = guide?.full_name?.trim() || guideBits.name;
      guidePhone = guide?.phone?.trim() || guideBits.phone;
      adults = Number(booking.adults ?? 0);
      children = Math.max(0, Number(booking.children ?? 0));
      agentName =
        one(
          booking.agents as
            | { company_name?: string | null }
            | { company_name?: string | null }[]
            | null,
        )?.company_name?.trim() || null;
      const guests =
        (booking.booking_guests as Array<{
          nationality?: string | null;
          passport_or_cid?: string | null;
        }> | null) ?? [];
      nationalities = guests.map((guest) => (guest.nationality ?? "").trim()).filter(Boolean);
      identityNos = guests
        .map((guest) => (guest.passport_or_cid ?? "").trim())
        .filter((value) => value && value !== "DEFERRED");
      const assignments =
        (booking.room_assignments as Array<{
          room_units?:
            | {
                label?: string | null;
                room_types?: { name?: string | null } | { name?: string | null }[] | null;
              }
            | Array<{
                label?: string | null;
                room_types?: { name?: string | null } | { name?: string | null }[] | null;
              }>
            | null;
        }> | null) ?? [];
      for (const assignment of assignments) {
        const unit = one(assignment.room_units);
        const label = unit?.label?.trim() ?? "";
        const typeName = one(unit?.room_types)?.name?.trim() ?? "";
        if (label) assignedRooms.push(label);
        if (label && typeName) roomTypeByNumber[label] = typeName;
      }
    }
  }

  const postedLines = guestVisibleBalanceLines(
    ((folio.folio_lines as Array<{
      id: string;
      description?: string | null;
      qty?: number | null;
      unit_price_btn?: number | null;
      amount_btn?: number | null;
      service_charge_btn?: number | null;
      gst_btn?: number | null;
      total_btn: number;
      business_date?: string | null;
      status: string;
      source_type?: string | null;
      reverses_line_id?: string | null;
      bill_to?: string | null;
    }> | null) ?? []).map((line) => ({
      ...line,
      total_btn: Number(line.total_btn),
    })),
  );
  const visible = postedLines.filter((line) => {
    const source = (line.source_type ?? "").toLowerCase();
    return source !== "payment" && source !== "deposit";
  });
  const receivedOnLines = postedLines
    .filter((line) => {
      const source = (line.source_type ?? "").toLowerCase();
      return source === "payment" || source === "deposit";
    })
    .reduce((sum, line) => sum + Math.abs(Number(line.total_btn)), 0);
  const charges: FolioChargeInput[] = visible
    .filter((line) =>
      lineBelongsOnBill(
        { source_type: line.source_type ?? "", description: line.description },
        bill,
      ),
    )
    .map((line) => ({
      id: line.id,
      description: line.description,
      source_type: line.source_type,
      total_btn: Number(line.total_btn),
      unit_price_btn: line.unit_price_btn == null ? null : Number(line.unit_price_btn),
      amount_btn: line.amount_btn == null ? null : Number(line.amount_btn),
      service_charge_btn:
        line.service_charge_btn == null ? null : Number(line.service_charge_btn),
      gst_btn: line.gst_btn == null ? null : Number(line.gst_btn),
      qty: line.qty == null ? null : Number(line.qty),
      business_date: line.business_date ?? null,
    }));
  const masterRows = bill === "master" ? await loadMasterBillRows(admin, propertyId, folioId) : null;

  const [property, paymentRows, fiscalDocs] = await Promise.all([
    loadProperty(admin, propertyId),
    admin
      .from("payments")
      .select("id, amount_btn, confirmation_status")
      .eq("property_id", propertyId)
      .eq("folio_id", folioId),
    admin
      .from("fiscal_documents")
      .select("doc_no, doc_kind, status")
      .eq("property_id", propertyId)
      .eq("folio_id", folioId)
      .eq("status", "issued")
      .in("doc_kind", ["invoice", "receipt"]),
  ]);
  const receivedOnPayments = (paymentRows.data ?? [])
    .filter((row) => {
      const status = (row.confirmation_status as string | null) ?? "confirmed";
      return status !== "pending_bank" && status !== "rejected" && status !== "void";
    })
    .reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0);
  const receivedTotal = Math.max(receivedOnPayments, receivedOnLines);
  const issuedDocs = fiscalDocs.data ?? [];
  const taxInvoiceNo =
    (issuedDocs.find((row) => row.doc_kind === "invoice")?.doc_no as string | undefined) ??
    null;
  const receiptNo =
    (issuedDocs.find((row) => row.doc_kind === "receipt")?.doc_no as string | undefined) ??
    null;
  const hotelName = property?.name?.trim() || "Hotel";
  const legalName = property?.legal_name?.trim() || "";
  const slug = property?.slug ?? "";
  const banks = property?.bank_accounts ?? [];
  const bank = banks.find((row) => row.qr_payload || row.qr_url || row.account);
  let bankQr: string | null = bank?.qr_url?.trim() || null;
  const staticPayload = bank?.qr_payload?.trim() ?? "";
  const pax = adults + children;
  const nationLabel = [...new Set(nationalities)].join(", ");
  const partyLine =
    [pax > 0 ? `${pax} pax` : null, nationLabel || null, mealPlanCode || null]
      .filter(Boolean)
      .join(" · ") || "—";
  const guestCountLabel =
    adults > 0 || children > 0 ? `${adults}+${children}` : "—";
  const folioNo =
    ((folio.doc_no as string | null) ?? "").trim() ||
    folioNoFromConfirmation(confirmation) ||
    "—";
  const built = buildRoomTaxInvoice(charges, {
    mealPlanCode,
    roomNames: roomTypeByNumber,
    folioNo,
    checkIn,
    checkOut,
    bill,
  });
  const includedBreakfast =
    bill === "fnb" && built.rows.length === 0
      ? includedBreakfastOnFoodBill(visible, { folioNo, checkIn, checkOut })
      : null;
  const invoice = includedBreakfast ?? built;
  const payers = new Set(
    visible.map((line) => ((line.bill_to ?? "guest") === "agent" ? "Agent" : "Guest")),
  );
  const payerLabel = payers.size === 1 ? ([...payers][0] ?? null) : null;
  const staff = await getStaffSession().catch(() => null);
  const signs = await loadBillSignatures(admin, staff?.staffId ?? null);
  const roomsLabel =
    [...new Set(assignedRooms)].join(", ") ||
    [
      ...new Set(
        charges
          .map((line) => line.description?.match(/\bRoom\s+(\d+[A-Za-z0-9-]*)/i)?.[1] ?? "")
          .filter(Boolean),
      ),
    ].join(", ") ||
    "—";
  const serviceChargeRate = Number(property?.service_charge_rate ?? 0.1);
  const gstRate = Number(property?.gst_rate ?? 0);
  const identityNo = [...new Set(identityNos)].join(", ") || "—";
  const identityType = identityKind(identityNos);
  const paperTotal = invoice.net;
  const masterTotal = visible.reduce((sum, line) => sum + Number(line.total_btn), 0);
  const payable = paperTotal;
  if (bill === "master" && staticPayload && payable > 0) {
    const emv = buildDynamicEmv(staticPayload, payable, folioNo || confirmation || hotelName);
    if (emv) {
      bankQr = await QRCode.toDataURL(emv, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
        color: { dark: "#1a1410", light: "#ffffff" },
      });
    }
  }

  return {
    folioId,
    bookingId,
    backHref: stayFolioHref(bookingId, folioId),
    bill,
    heading: BILL_KIND_LABELS[bill],
    title: bill === "master" ? BILL_KIND_TITLES.master : (folioNo ?? BILL_KIND_TITLES[bill]),
    confirmation,
    property: {
      name: hotelName,
      legal_name: property?.legal_name,
      address: property?.address,
      phone: property?.phone,
      whatsapp: property?.whatsapp,
      email: property?.email,
      website:
        slug === "pelbu-olakha" || slug === "pelbu-suites-olakha"
          ? "www.pelbusuites.bt"
          : null,
      tax_id: property?.tax_id ?? null,
      logo_public_id: property?.logo_public_id,
      tagline:
        legalName && legalName !== hotelName
          ? legalName
          : slug === "pelbu-olakha" || slug === "pelbu-suites-olakha"
            ? "Hotel · Olakha, Thimphu"
            : null,
    },
    guestName,
    agentName,
    groupName,
    payerLabel,
    preparedBy: staff?.fullName?.trim() || null,
    preparedSignature: signs.preparedSignature,
    signatoryName: signs.signatoryName,
    signatorySignature: signs.signatorySignature,
    arrival: fmtDate(checkIn),
    departure: fmtDate(checkOut),
    guideLine: [guideName, guidePhone].filter(Boolean).join(" · ") || "—",
    guideName,
    guidePhone,
    partyLine,
    folioNo,
    taxId: property?.tax_id?.trim() || null,
    issueDate: slashDate(thimphuToday()),
    roomsLabel,
    guestCountLabel,
    mealPlanCode,
    identityNo,
    identityType,
    serviceChargeRate,
    gstRate,
    invoice,
    masterRows,
    charges,
    paperTotal,
    masterTotal,
    receivedTotal,
    taxInvoiceNo,
    receiptNo,
    canIssueTaxPair:
      receivedCoversMasterBill(masterTotal, receivedTotal) && !(taxInvoiceNo && receiptNo),
    banks,
    bankQr,
  };
}

async function loadMasterBillRows(
  admin: Admin,
  propertyId: string,
  folioId: string,
): Promise<MasterBillRow[]> {
  const { data: self } = await admin
    .from("folios")
    .select("id, master_folio_id")
    .eq("id", folioId)
    .eq("property_id", propertyId)
    .maybeSingle();
  const rootId = (self?.master_folio_id as string | null) ?? folioId;
  const { data: family } = await admin
    .from("folios")
    .select(
      `id, doc_no, label, booking_id,
       folio_lines(id, description, total_btn, status, source_type, reverses_line_id)`,
    )
    .eq("property_id", propertyId)
    .or(`id.eq.${rootId},master_folio_id.eq.${rootId}`);

  const folios = family ?? [];
  const bookingIds = [
    ...new Set(
      folios
        .map((row) => row.booking_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: bookings } = bookingIds.length
    ? await admin
        .from("bookings")
        .select(
          `id, contact_name, confirmation_code, check_in, check_out, meal_plan_code,
           room_assignments(room_units(label))`,
        )
        .in("id", bookingIds)
    : { data: [] as never[] };

  const byBooking = new Map(
    (bookings ?? []).map((booking) => [booking.id as string, booking]),
  );

  return buildMasterBillRows(
    folios.map((row) => {
      const booking = byBooking.get((row.booking_id as string | null) ?? "");
      const rooms = (
        (booking?.room_assignments as
          | Array<{
              room_units?:
                | { label?: string | null }
                | { label?: string | null }[]
                | null;
            }>
          | null) ?? []
      )
        .map((assignment) => one(assignment.room_units)?.label?.trim() ?? "")
        .filter(Boolean);
      const stayConfirmation = (booking?.confirmation_code as string | null) ?? null;
      const lines = guestVisibleBalanceLines(
        ((row.folio_lines as Array<{
          id: string;
          description?: string | null;
          total_btn: number;
          status: string;
          source_type?: string | null;
          reverses_line_id?: string | null;
        }> | null) ?? []).map((line) => ({
          ...line,
          total_btn: Number(line.total_btn),
        })),
      ).filter((line) => {
        const source = (line.source_type ?? "").toLowerCase();
        return source !== "payment" && source !== "deposit";
      });
      return {
        id: row.id as string,
        docNo:
          ((row.doc_no as string | null) ?? "").trim() ||
          folioNoFromConfirmation(stayConfirmation),
        guest:
          (booking?.contact_name as string | null)?.trim() ||
          (row.label as string | null)?.trim() ||
          "Guest",
        room: [...new Set(rooms)].join(", "),
        arrival: (booking?.check_in as string | null) ?? null,
        departure: (booking?.check_out as string | null) ?? null,
        mealPlanCode: (booking?.meal_plan_code as string | null) ?? null,
        lines,
      };
    }),
  );
}
