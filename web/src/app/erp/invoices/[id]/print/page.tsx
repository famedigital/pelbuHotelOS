import { DocPrintControls } from "@/components/erp/DocPrintControls";
import { FiscalDocEmailForm } from "@/components/erp/FiscalDocEmailForm";
import {
  FiscalDocFooter,
  FiscalLetterhead,
  FiscalFoodTickets,
  FiscalLinesTable,
  FiscalParties,
  FiscalPayBlock,
  FiscalSignOff,
  FiscalStayStrip,
  FiscalTotalsBlock,
  type FiscalLineRow,
} from "@/components/erp/print/FiscalLetterhead";
import { PrintEditableValue } from "@/components/erp/print/PrintEditableValue";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { PRODUCTION_CANONICAL } from "@/lib/site";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  BILL_KIND_LABELS,
  BILL_KIND_TITLES,
  type BillKind,
  classifyBillLine,
  foodBillLabel,
  foodBillTitle,
  lineBelongsOnBill,
  parseBillKind,
} from "@/lib/folio/bill-kinds";
import {
  presentFnbBillLines,
  stayServiceDates,
  type PublishedMenu,
} from "@/lib/folio/package-meal-lines";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import {
  foodAcknowledgedLabel,
  foodPaymentLabel,
  foodPlaceLabel,
} from "@/lib/folio/food-bill-print";
import {
  formatGuestBtn,
  isGuestRateAdjDescription,
  roundBtn,
} from "@/lib/pricing";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { nightsBetween } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { buildDynamicEmv } from "@/lib/bank-qr/emv";
import QRCode from "qrcode";

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
  service_charge_btn?: number;
  amount_btn?: number;
  status: string;
  source_type: string;
  source_id?: string | null;
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

function fmtHotelWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
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

function sumServiceCharge(rows: FolioLine[]): number {
  return roundBtn(
    rows.reduce((s, l) => s + Number(l.service_charge_btn ?? 0), 0),
  );
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
          "label, booking_id, agent_id, folio_type, agents(company_name, contact_email, contact_name), folio_lines(id, description, total_btn, gst_btn, service_charge_btn, amount_btn, status, source_type, source_id, reverses_line_id)",
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
  let mealPlanCode: string | null = null;
  let roomProductLines: string[] = [];
  let roomUnitLabels: string[] = [];
  let guideNumber: string | null = null;

  const bookingId = folio?.booking_id as string | null | undefined;
  if (bookingId) {
    const { data: booking } = await admin
      .from("bookings")
      .select(
        `contact_email, contact_name, check_in, check_out, rooms, meal_plan_code, guide_number,
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
      mealPlanCode = (booking.meal_plan_code as string | null) ?? null;
      guideNumber = (booking.guide_number as string | null) ?? null;
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

  let payQr: string | null = null;
  if (folioId) {
    const { data: link } = await admin
      .from("payment_links")
      .select("token")
      .eq("folio_id", folioId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const token = (link?.token as string | undefined)?.trim();
    if (token) {
      const payUrl = `${PRODUCTION_CANONICAL.replace(/\/$/, "")}/pay/${token}`;
      payQr = await QRCode.toDataURL(payUrl, { margin: 1, width: 192 });
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
  const serviceChargeBtn = sumServiceCharge(onBill);
  const bank = (property?.bank_accounts ?? []).find(
    (row) => row.qr_payload || row.qr_url || row.account,
  );
  let bankQr: string | null = null;
  const staticPayload = bank?.qr_payload?.trim() ?? "";
  if (staticPayload && totalBtn > 0) {
    const emv = buildDynamicEmv(
      staticPayload,
      totalBtn,
      String(doc.doc_no ?? ""),
    );
    if (emv) {
      bankQr = await QRCode.toDataURL(emv, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
        color: { dark: "#1a1411", light: "#ffffff" },
      });
    }
  }

  let publishedMenus: PublishedMenu[] = [];
  if (bill === "fnb" && checkIn && checkOut && mealPlanCode) {
    const dates = stayServiceDates(checkIn, checkOut);
    if (dates.length > 0) {
      const { data: menuRows } = await admin
        .from("kitchen_meal_services")
        .select("service_date, meal_period, menu_note, menu_highlights")
        .eq("property_id", doc.property_id as string)
        .in("service_date", dates);
      publishedMenus = (menuRows ?? []).map((row) => ({
        serviceDate: String(row.service_date),
        mealPeriod: row.meal_period as PublishedMenu["mealPeriod"],
        menuNote: (row.menu_note as string | null) ?? null,
        menuHighlights: (row.menu_highlights as string | null) ?? null,
      }));
    }
  }

  const posLines =
    bill === "fnb"
      ? onBill.filter((line) => {
          const source = (line.source_type ?? "").toLowerCase();
          return (source === "order" || source === "pos") && Boolean(line.source_id);
        })
      : [];
  const orderIds = [
    ...new Set(
      posLines
        .map((line) => line.source_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  type FoodItem = { name: string; qty: number; rate: number; notes: string | null };
  type FoodOrder = {
    id: string;
    when: string;
    place: string;
    enteredBy: string;
    acknowledged: string;
    payment: string;
    items: FoodItem[];
  };
  let foodOrders: FoodOrder[] = [];
  if (orderIds.length > 0) {
    const { data: orderRows } = await admin
      .from("orders")
      .select(
        `id, created_at, outlet, kot_status, confirmed_at, confirmed_by, server_staff_id, posted_to_folio_at,
         dining_tables(name, area),
         order_items(name_snapshot, qty, unit_price_btn, voided_at, line_notes),
         order_tenders(method)`,
      )
      .in("id", orderIds);
    const staffIds = [
      ...new Set(
        (orderRows ?? []).flatMap((row) =>
          [row.server_staff_id, row.confirmed_by].filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ),
    ];
    const staffName = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staffRows } = await admin
        .from("staff_members")
        .select("id, full_name")
        .in("id", staffIds);
      for (const staff of staffRows ?? []) {
        staffName.set(staff.id as string, (staff.full_name as string) || "Staff");
      }
    }
    foodOrders = (orderRows ?? []).map((row) => {
      const table = firstOf(
        row.dining_tables as MaybeList<{ name?: string | null; area?: string | null }>,
      );
      const items = (
        (row.order_items as
          | {
              name_snapshot?: string | null;
              qty?: number | null;
              unit_price_btn?: number | null;
              voided_at?: string | null;
              line_notes?: string | null;
            }[]
          | null) ?? []
      ).filter((item) => !item.voided_at);
      const methods = (
        (row.order_tenders as { method?: string | null }[] | null) ?? []
      )
        .map((tender) => tender.method ?? "")
        .filter(Boolean);
      const posted = Boolean(row.posted_to_folio_at);
      const confirmedAt = (row.confirmed_at as string | null) ?? null;
      const confirmedById = (row.confirmed_by as string | null) ?? null;
      const serverId = (row.server_staff_id as string | null) ?? null;
      return {
        id: row.id as string,
        when: fmtHotelWhen(String(row.created_at)),
        place: foodPlaceLabel({
          outlet: row.outlet as string | null,
          tableName: table?.name ?? null,
          tableArea: table?.area ?? null,
        }),
        enteredBy: (serverId && staffName.get(serverId)) || "Desk",
        acknowledged: foodAcknowledgedLabel({
          confirmedAt,
          confirmedBy: confirmedById ? staffName.get(confirmedById) : null,
          confirmedWhen: confirmedAt ? fmtHotelWhen(confirmedAt) : null,
          kotStatus: (row.kot_status as string | null) ?? null,
          postedToRoom: posted,
        }),
        payment: foodPaymentLabel(methods, posted),
        items: items.map((item) => ({
          name: item.name_snapshot?.trim() || "Item",
          qty: Math.max(1, Number(item.qty) || 1),
          rate: Number(item.unit_price_btn) || 0,
          notes: item.line_notes?.trim() || null,
        })),
      };
    });
  }
  const foodById = new Map(foodOrders.map((order) => [order.id, order]));

  const displayLines =
    bill === "fnb"
      ? presentFnbBillLines({
          lines: onBill.filter((line) => {
            const source = (line.source_type ?? "").toLowerCase();
            return !((source === "order" || source === "pos") && line.source_id);
          }),
          mealPlanCode,
          checkIn,
          checkOut,
          menus: publishedMenus,
        })
      : onBill;

  const foodBill = bill === "fnb" && foodOrders.length > 0;
  const kind = doc.doc_kind as string;
  const kindLabel =
    kind === "receipt"
      ? "Receipt"
      : kind === "credit_note"
        ? "Credit note"
        : foodBill
          ? "Food bill"
          : bill === "fnb"
            ? foodBillLabel(mealPlanCode)
            : BILL_KIND_LABELS[bill];
  const kindTitle =
    kind === "receipt"
      ? "RECEIPT"
      : kind === "credit_note"
        ? "CREDIT NOTE"
        : foodBill
          ? "FOOD BILL"
          : bill === "fnb"
            ? foodBillTitle(mealPlanCode)
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
  const netSubtotal = roundBtn(
    Math.max(0, totalBtn - gstBtn - serviceChargeBtn),
  );
  const packageRows: FiscalLineRow[] = displayLines.map((line) => {
    const isPackageMeal =
      bill === "fnb" && (line.source_type ?? "").toLowerCase() === "meal_plan";
    const packageMenu =
      isPackageMeal && "hint" in line ? (line.hint ?? null) : null;
    const sc = Number(
      "service_charge_btn" in line ? (line.service_charge_btn ?? 0) : 0,
    );
    const gst = Number("gst_btn" in line ? (line.gst_btn ?? 0) : 0);
    const total = Number(line.total_btn);
    return {
      id: line.id,
      description: line.description ?? "Charge",
      hint: isPackageMeal
        ? packageMenu
        : classifyBillLine(line) === "fnb"
          ? "F&B"
          : classifyBillLine(line) === "room"
            ? "Room"
            : null,
      qty: 1,
      rate: Math.max(0, total - gst - sc),
      sc,
      gst,
      amount: total,
      foc: total === 0,
    };
  });
  const seenOrders = new Set<string>();
  const itemRows: FiscalLineRow[] = [];
  for (const line of posLines) {
    const orderId = line.source_id;
    if (!orderId || seenOrders.has(orderId)) continue;
    seenOrders.add(orderId);
    const order = foodById.get(orderId);
    const hint = order
      ? `${order.when} · ${order.place} · ${order.payment}`
      : "F&B";
    if (!order || order.items.length === 0) {
      const sc = Number(line.service_charge_btn ?? 0);
      const gst = Number(line.gst_btn ?? 0);
      const total = Number(line.total_btn);
      itemRows.push({
        id: line.id,
        description: line.description ?? "Food",
        hint,
        qty: 1,
        rate: Math.max(0, total - gst - sc),
        amount: total,
        foc: total === 0,
      });
      continue;
    }
    let extended = 0;
    for (const item of order.items) {
      const amount = roundBtn(item.qty * item.rate);
      extended = roundBtn(extended + amount);
      itemRows.push({
        id: `${orderId}-${itemRows.length}`,
        description: item.name,
        hint: item.notes ? `${hint} · ${item.notes}` : hint,
        qty: item.qty,
        rate: item.rate,
        amount,
        foc: amount === 0,
      });
    }
    const chargedNet = roundBtn(
      posLines
        .filter((row) => row.source_id === orderId)
        .reduce((sum, row) => {
          const sc = Number(row.service_charge_btn ?? 0);
          const gst = Number(row.gst_btn ?? 0);
          return sum + Math.max(0, Number(row.total_btn) - gst - sc);
        }, 0),
    );
    const gap = roundBtn(chargedNet - extended);
    if (Math.abs(gap) >= 0.5) {
      itemRows.push({
        id: `${orderId}-adj`,
        description: gap < 0 ? "Discount" : "Adjustment",
        hint,
        qty: 1,
        rate: gap,
        amount: gap,
      });
    }
  }
  const fiscalLines: FiscalLineRow[] = [...packageRows, ...itemRows];

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
    { kind: "fnb", label: foodBillLabel(mealPlanCode) },
  ];

  const showBillSwitch = kind === "invoice" || kind === "receipt";

  return (
    <div className="erp flex min-h-screen flex-col bg-muted/40 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] print:block print:min-h-0 print:bg-white">
      <div className="contents print:hidden lg:sticky lg:top-0 lg:z-10 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:bg-background">
        <div className="order-1 border-b border-border bg-background/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-sm max-lg:sticky max-lg:top-0 max-lg:z-20 lg:order-none lg:border-b-0 lg:bg-background lg:px-5 lg:pt-5 lg:pb-0 lg:backdrop-blur-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
                {kindLabel} print
              </p>
              <h1 className="mt-1 truncate font-mono text-xl font-semibold text-foreground">
                {doc.doc_no as string}
              </h1>
            </div>
            <nav className="flex shrink-0 flex-col items-end gap-1 text-sm lg:hidden">
              {folioId ? (
                <a
                  href={`/erp/folios/${folioId}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Folio
                </a>
              ) : null}
              <a
                href="/erp/invoices"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Invoices
              </a>
            </nav>
          </div>
          <p className="mt-1 hidden text-xs text-muted-foreground lg:block">
            Guest totals whole Nu ending 0 or 5
          </p>

          {showBillSwitch ? (
            <nav className="mt-3 lg:mt-6" aria-label="Bill">
              <p className="hidden text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase lg:block">
                Bill
              </p>
              <div className="flex gap-1.5 overflow-x-auto lg:mt-2 lg:flex-col lg:overflow-visible">
                {billLinks.map((b) => (
                  <a
                    key={b.kind}
                    href={`${basePrintHref}?bill=${b.kind}`}
                    aria-current={bill === b.kind ? "page" : undefined}
                    className={
                      bill === b.kind
                        ? "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md bg-foreground px-2.5 text-center text-sm leading-tight font-medium text-background touch-manipulation lg:h-9 lg:min-h-0 lg:w-full lg:flex-none lg:justify-start lg:px-3"
                        : "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md border px-2.5 text-center text-sm leading-tight touch-manipulation hover:bg-muted lg:h-9 lg:min-h-0 lg:w-full lg:flex-none lg:justify-start lg:px-3"
                    }
                  >
                    {b.label}
                  </a>
                ))}
              </div>
            </nav>
          ) : null}
        </div>

        <div className="order-5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:border-t max-lg:border-border max-lg:bg-background max-lg:px-3 max-lg:pt-2 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-8px_24px_rgba(26,20,16,0.08)] lg:order-none lg:px-5 lg:pt-6">
          <p className="mb-2 hidden text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase lg:block">
            Paper
          </p>
          <DocPrintControls stacked defaultSize="a4" printLabel="Print / PDF" />
        </div>

        {folioId && showBillSwitch ? (
          <div className="order-3 px-3 pt-4 lg:order-none lg:px-5 lg:pt-6">
            <FiscalDocEmailForm
              folioId={folioId}
              fiscalDocId={doc.id as string}
              docKind={kind === "receipt" ? "receipt" : "invoice"}
              defaultEmail={guestEmail}
              defaultName={guestName}
            />
          </div>
        ) : null}

        <nav className="order-4 mt-6 hidden flex-col gap-2 border-t border-border px-5 pt-4 pb-5 text-sm lg:order-none lg:flex">
          {folioId ? (
            <a
              href={`/erp/folios/${folioId}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Back to folio
            </a>
          ) : null}
          <a
            href="/erp/invoices"
            className="text-foreground underline-offset-4 hover:underline"
          >
            All invoices
          </a>
        </nav>
        <div
          className="order-6 h-28 shrink-0 lg:hidden"
          aria-hidden="true"
        />
      </div>

      <main className="order-2 min-w-0 overflow-x-auto px-2 py-3 lg:order-none lg:overflow-visible lg:px-8 lg:py-8 print:overflow-visible print:p-0">
      <article
        className={`fiscal-invoice-sheet fiscal-invoice-preview doc-print-sheet mx-auto w-full max-w-[210mm] border border-[#d8d0c6] bg-white px-[12mm] py-[8mm] text-[#1a1410] shadow-[0_12px_40px_rgba(26,20,16,0.08)] print:border-0 print:px-0 print:py-0 print:shadow-none ${fiscalLines.length >= 8 ? "fiscal-invoice-compact" : ""} ${fiscalLines.length >= 16 ? "fiscal-invoice-tight" : ""}`}
        aria-label={`${kindLabel} ${doc.doc_no as string}`}
      >
        <FiscalLetterhead
          property={{
            name: hotelName,
            legal_name: legalName,
            address: property?.address,
            phone: property?.phone,
            whatsapp: property?.whatsapp,
            email: property?.email,
            website:
              property?.slug === "pelbu-olakha" ||
              property?.slug === "pelbu-suites-olakha"
                ? "www.pelbusuites.bt"
                : null,
            tax_id: property?.tax_id ?? null,
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
          title={kindTitle}
          meta={[
            { label: "Date", value: issueDate },
            { label: "Inv no.", value: String(doc.doc_no) },
            {
              label: "Room",
              value: (
                <PrintEditableValue
                  syncKey={`inv-room-${doc.id as string}`}
                  initial={
                    roomUnitLabels.join(", ") || roomProductLines.join("; ")
                  }
                  hint
                />
              ),
            },
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
            {
              label: "Rooms",
              value: (
                <PrintEditableValue
                  syncKey={`inv-room-${doc.id as string}`}
                  initial={
                    roomUnitLabels.join(", ") || roomProductLines.join("; ")
                  }
                />
              ),
            },
            ...(agentName
              ? [{ label: "Agent", value: agentName }]
              : []),
            ...(guideNumber
              ? [{ label: "Guide", value: guideNumber }]
              : []),
          ]}
        />

        <FiscalFoodTickets tickets={foodOrders} />

        {fiscalLines.length > 0 ? (
          <>
            <FiscalLinesTable
              rows={fiscalLines}
              dense={fiscalLines.length >= 8}
              showSc={foodOrders.length === 0 && serviceChargeBtn > 0.005}
              showGst={foodOrders.length === 0 && gstBtn > 0.005}
            />
            {foodOrders.length > 0 ? (
              <p className="mt-1 text-[10px] text-[#5c534c]">
                Each line is rate × qty for that item. Service charge and GST are in the total below.
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-6 rounded-md border border-amber-700/30 bg-amber-50 px-4 py-3 text-center text-sm text-[#3a322c]">
            <p className="font-semibold">No guest-visible charges on this invoice</p>
            <p className="mt-1 text-[13px] text-[#5c534c]">
              Usually after voiding every line. Guest due is Nu 0 until you
              re-post room nights (StayHub → Folio → Post charges / Post room
              night), then reopen or reprint this INV. Do not invent a second
              invoice number without a credit note.
            </p>
            <p className="mt-2 text-[12px]">
              <a
                href="/erp/training#stay-money"
                className="font-medium underline underline-offset-2"
              >
                How stay money works
              </a>
            </p>
          </div>
        )}

        <FiscalTotalsBlock
          subtotal={netSubtotal}
          serviceCharge={serviceChargeBtn}
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

        <FiscalPayBlock
          banks={property?.bank_accounts ?? []}
          qrDataUrl={bankQr ?? bank?.qr_url ?? payQr}
        />

        <FiscalSignOff
          hotelName={hotelName}
          leftLabel={
            guideNumber
              ? `Guide signature · ${guideNumber}`
              : "Guide signature"
          }
        />
        <FiscalDocFooter property={{ name: hotelName, address: property?.address }} />
      </article>
      </main>
    </div>
  );
}
