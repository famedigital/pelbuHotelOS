import "server-only";

import { buildWorkbook } from "@/lib/accounting/export";
import { netFolioBalance } from "@/lib/folio/balance";
import {
  HOTEL_BACKUP_PACK_VERSION,
} from "@/lib/night-audit/hotel-backup-contract";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export {
  HOTEL_BACKUP_BUCKET,
  HOTEL_BACKUP_PACK_VERSION,
  HOTEL_BACKUP_SHEET_NAMES,
  hotelBackupStoragePath,
} from "@/lib/night-audit/hotel-backup-contract";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type HotelBackupAuditSummary = {
  auditId?: string | null;
  roomsOccupied?: number;
  roomsComp?: number;
  posted?: number;
  skipped?: number;
  openFolios?: number;
  folioChargesBtn?: number;
  folioPaymentsBtn?: number;
  noShows?: number;
  blockers?: string[];
  runBy?: string;
  notes?: string | null;
  forceClose?: boolean;
};

function shiftDate(yyyymmdd: string, days: number): string {
  const d = new Date(`${yyyymmdd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cell(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function sheet(
  name: string,
  header: string[],
  rows: (string | number)[][],
): { name: string; header: string[]; rows: (string | number)[][] } {
  return { name: name.slice(0, 31), header, rows };
}

/**
 * Full hotel backup workbook (ops windows + settings master).
 * pack_version 1 — future clean-state import contract.
 */
export async function buildHotelBackupPack(
  admin: Admin,
  propertyId: string,
  businessDate: string,
  auditSummary?: HotelBackupAuditSummary | null,
): Promise<{ buffer: Buffer; filename: string; propertySlug: string }> {
  const date = businessDate.slice(0, 10);
  const from90 = shiftDate(date, -90);
  const to90 = shiftDate(date, 90);
  const to7 = shiftDate(date, 7);
  const linesFrom = shiftDate(date, -30);
  const linesTo = shiftDate(date, 30);

  const { data: property } = await admin
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  const slug = (property?.slug as string | undefined) ?? "property";
  const propertyName = (property?.name as string | undefined) ?? "Hotel";

  const [
    inHouseRes,
    arrivalsRes,
    departuresRes,
    bookingsRes,
    folioLinesRes,
    paymentsRes,
    laundryRes,
    roomTypesRes,
    roomsRes,
    seasonsRes,
    ratesRes,
    depositRes,
    outletsRes,
    menuRes,
    laundryCatRes,
    agentsRes,
    staffRes,
    tablesRes,
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, contact_email, check_in, check_out, status, payment_mode, guest_origin, guide_number, agent_id, adults, rooms, booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url), room_assignments(room_units(label)), folios(id, status, folio_lines(id, total_btn, status, reverses_line_id))",
      )
      .eq("property_id", propertyId)
      .eq("status", "checked_in")
      .limit(200),
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, check_in, check_out, status, payment_mode, agent_id, adults, rooms",
      )
      .eq("property_id", propertyId)
      .in("status", ["pending", "confirmed", "held"])
      .gte("check_in", date)
      .lte("check_in", to7)
      .order("check_in")
      .limit(300),
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, check_in, check_out, status, room_assignments(room_units(label))",
      )
      .eq("property_id", propertyId)
      .eq("status", "checked_in")
      .eq("check_out", date)
      .limit(100),
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, contact_email, check_in, check_out, status, source, payment_mode, guest_origin, guide_number, agent_id, adults, rooms, notes, created_at, booking_guests(full_name, nationality, passport_or_cid, sdf_ref, sdf_doc_url)",
      )
      .eq("property_id", propertyId)
      .gte("check_in", from90)
      .lte("check_in", to90)
      .order("check_in")
      .limit(2000),
    admin
      .from("folio_lines")
      .select(
        "id, folio_id, description, source_type, source_id, amount_btn, gst_btn, total_btn, status, business_date, room_unit_id, reverses_line_id, created_at, folios!inner(property_id, status)",
      )
      .eq("folios.property_id", propertyId)
      .gte("created_at", `${linesFrom}T00:00:00Z`)
      .lte("created_at", `${linesTo}T23:59:59Z`)
      .limit(5000),
    admin
      .from("payments")
      .select(
        "id, folio_id, booking_id, amount_btn, method, reference, notes, created_at, idempotency_key",
      )
      .eq("property_id", propertyId)
      .gte("created_at", `${from90}T00:00:00Z`)
      .lte("created_at", `${date}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(3000),
    admin
      .from("laundry_orders")
      .select(
        "id, guest_name, room_label_snapshot, status, total_btn, folio_id, requested_at, laundry_order_items(name_snapshot, requested_qty, confirmed_qty, unit_price_btn), laundry_order_bags(public_code, status, bag_seq)",
      )
      .eq("property_id", propertyId)
      .not("status", "in", "(delivered,cancelled)")
      .limit(500),
    admin.from("room_types").select("*").eq("property_id", propertyId),
    admin.from("room_units").select("*").eq("property_id", propertyId),
    admin.from("seasons").select("*").eq("property_id", propertyId),
    admin.from("room_rates").select("*").eq("property_id", propertyId),
    admin
      .from("property_deposit_rules")
      .select("*")
      .eq("property_id", propertyId),
    admin.from("property_outlets").select("*").eq("property_id", propertyId),
    admin.from("menu_items").select("*").eq("property_id", propertyId),
    admin
      .from("laundry_catalog_items")
      .select("*")
      .eq("property_id", propertyId),
    admin
      .from("agents")
      .select(
        "id, company_name, market, status, rate_tier, credit_limit, credit_used, created_at, can_login",
      )
      .limit(500),
    admin
      .from("staff_members")
      .select(
        "id, property_id, full_name, role_label, department, access_level, desk_role, can_access_desk, employee_code, phone, email, is_active, created_at",
      )
      .eq("property_id", propertyId),
    admin.from("dining_tables").select("*").eq("property_id", propertyId),
  ]);

  const inHouseRows = (inHouseRes.data ?? []).map((b) => {
    const rooms = (
      (b.room_assignments as
        | { room_units: { label?: string } | { label?: string }[] | null }[]
        | null) ?? []
    )
      .map((a) => {
        const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
        return u?.label ?? "";
      })
      .filter(Boolean)
      .join(", ");
    const folio = (
      (b.folios as
        | {
            id: string;
            status: string;
            folio_lines?: {
              id: string;
              total_btn: number;
              status: string;
              reverses_line_id?: string | null;
            }[];
          }[]
        | null) ?? []
    ).find((f) => f.status === "open");
    const bal = folio?.folio_lines
      ? netFolioBalance(folio.folio_lines)
      : 0;
    const guests = (
      (b.booking_guests as
        | {
            full_name: string;
            nationality: string | null;
            passport_or_cid: string | null;
            sdf_ref: string | null;
            sdf_doc_url: string | null;
          }[]
        | null) ?? []
    )
      .map(
        (g) =>
          `${g.full_name}|${g.nationality ?? ""}|${g.passport_or_cid ?? ""}|${g.sdf_ref ?? ""}|${g.sdf_doc_url ?? ""}`,
      )
      .join(" ; ");
    return [
      cell(b.id),
      cell(b.contact_name),
      cell(b.contact_phone),
      cell(b.contact_email),
      cell(b.check_in),
      cell(b.check_out),
      cell(rooms),
      cell(folio?.id),
      bal,
      cell(b.payment_mode),
      cell(b.guest_origin),
      cell(b.guide_number),
      cell(b.agent_id),
      guests,
    ];
  });

  const bookingRows = (bookingsRes.data ?? []).map((b) => {
    const guests = (
      (b.booking_guests as
        | {
            full_name: string;
            nationality: string | null;
            passport_or_cid: string | null;
            sdf_ref: string | null;
            sdf_doc_url: string | null;
          }[]
        | null) ?? []
    )
      .map(
        (g) =>
          `${g.full_name}|${g.nationality ?? ""}|${g.passport_or_cid ?? ""}|${g.sdf_ref ?? ""}|${g.sdf_doc_url ?? ""}`,
      )
      .join(" ; ");
    return [
      cell(b.id),
      cell(b.status),
      cell(b.source),
      cell(b.contact_name),
      cell(b.contact_phone),
      cell(b.contact_email),
      cell(b.check_in),
      cell(b.check_out),
      cell(b.payment_mode),
      cell(b.guest_origin),
      cell(b.guide_number),
      cell(b.agent_id),
      cell(b.adults),
      cell(b.rooms),
      cell(b.notes),
      cell(b.created_at),
      guests,
    ];
  });

  const laundryRows = (laundryRes.data ?? []).map((o) => {
    const items = (
      (o.laundry_order_items as
        | {
            name_snapshot: string;
            requested_qty: number;
            confirmed_qty: number | null;
            unit_price_btn: number | null;
          }[]
        | null) ?? []
    )
      .map(
        (i) =>
          `${i.name_snapshot} x${i.confirmed_qty ?? i.requested_qty}@${i.unit_price_btn ?? ""}`,
      )
      .join("; ");
    const bags = (
      (o.laundry_order_bags as
        | { public_code: string; status: string; bag_seq: number }[]
        | null) ?? []
    )
      .map((bag) => `${bag.bag_seq}:${bag.public_code}:${bag.status}`)
      .join("; ");
    return [
      cell(o.id),
      cell(o.guest_name),
      cell(o.room_label_snapshot),
      cell(o.status),
      cell(o.total_btn),
      cell(o.folio_id),
      cell(o.requested_at),
      items,
      bags,
    ];
  });

  function rowsFromObjects(
    objs: Record<string, unknown>[] | null | undefined,
    keys: string[],
  ): (string | number)[][] {
    return (objs ?? []).map((row) => keys.map((k) => cell(row[k])));
  }

  const propertyKeys = property
    ? Object.keys(property as Record<string, unknown>).sort()
    : ["id"];
  const propertyRows = property
    ? [propertyKeys.map((k) => cell((property as Record<string, unknown>)[k]))]
    : [];

  const roomTypeKeys = [
    "id",
    "property_id",
    "code",
    "name",
    "inventory_kind",
  ];
  const roomKeys = [
    "id",
    "property_id",
    "room_type_id",
    "label",
    "floor_label",
    "inventory_kind",
    "hk_status",
    "sort_order",
  ];
  const seasonKeys = ["id", "property_id", "kind", "starts_on", "ends_on"];
  const rateKeys = [
    "id",
    "property_id",
    "room_type_id",
    "season_id",
    "guest_origin",
    "amount_btn",
  ];
  const depositKeys = Object.keys(
    (depositRes.data?.[0] as Record<string, unknown> | undefined) ?? {
      id: 1,
      property_id: 1,
    },
  );
  const outletKeys = Object.keys(
    (outletsRes.data?.[0] as Record<string, unknown> | undefined) ?? {
      id: 1,
      property_id: 1,
      code: 1,
      name: 1,
    },
  );
  const menuKeys = Object.keys(
    (menuRes.data?.[0] as Record<string, unknown> | undefined) ?? {
      id: 1,
      property_id: 1,
      name: 1,
      price_btn: 1,
      outlet: 1,
      is_active: 1,
    },
  );
  const laundryCatKeys = Object.keys(
    (laundryCatRes.data?.[0] as Record<string, unknown> | undefined) ?? {
      id: 1,
      property_id: 1,
      name: 1,
      price_btn: 1,
    },
  );
  const agentKeys = [
    "id",
    "company_name",
    "market",
    "status",
    "rate_tier",
    "credit_limit",
    "credit_used",
    "created_at",
    "can_login",
  ];
  const staffKeys = [
    "id",
    "property_id",
    "full_name",
    "role_label",
    "department",
    "access_level",
    "desk_role",
    "can_access_desk",
    "employee_code",
    "phone",
    "email",
    "is_active",
    "created_at",
  ];
  const tableKeys = Object.keys(
    (tablesRes.data?.[0] as Record<string, unknown> | undefined) ?? {
      id: 1,
      property_id: 1,
      label: 1,
    },
  );

  const sheets = [
    sheet(
      "_meta",
      ["key", "value"],
      [
        ["pack_version", HOTEL_BACKUP_PACK_VERSION],
        ["property_id", propertyId],
        ["slug", slug],
        ["name", propertyName],
        ["business_date", date],
        ["generated_at", new Date().toISOString()],
        ["audit_id", auditSummary?.auditId ?? ""],
        ["from90", from90],
        ["to90", to90],
      ],
    ),
    sheet(
      "Audit",
      ["field", "value"],
      [
        ["business_date", date],
        ["rooms_occupied", auditSummary?.roomsOccupied ?? ""],
        ["rooms_comp", auditSummary?.roomsComp ?? ""],
        ["room_nights_posted", auditSummary?.posted ?? ""],
        ["room_nights_skipped", auditSummary?.skipped ?? ""],
        ["open_folios", auditSummary?.openFolios ?? ""],
        ["folio_charges_btn", auditSummary?.folioChargesBtn ?? ""],
        ["folio_payments_btn", auditSummary?.folioPaymentsBtn ?? ""],
        ["no_shows", auditSummary?.noShows ?? ""],
        ["blockers", (auditSummary?.blockers ?? []).join("; ")],
        ["run_by", auditSummary?.runBy ?? ""],
        ["notes", auditSummary?.notes ?? ""],
        ["force_close", auditSummary?.forceClose ? "true" : "false"],
      ],
    ),
    sheet(
      "InHouse",
      [
        "booking_id",
        "contact_name",
        "contact_phone",
        "contact_email",
        "check_in",
        "check_out",
        "rooms",
        "folio_id",
        "balance_btn",
        "payment_mode",
        "guest_origin",
        "guide_number",
        "agent_id",
        "guests",
      ],
      inHouseRows,
    ),
    sheet(
      "Arrivals7d",
      [
        "id",
        "contact_name",
        "contact_phone",
        "check_in",
        "check_out",
        "status",
        "payment_mode",
        "agent_id",
        "adults",
        "rooms",
      ],
      (arrivalsRes.data ?? []).map((b) => [
        cell(b.id),
        cell(b.contact_name),
        cell(b.contact_phone),
        cell(b.check_in),
        cell(b.check_out),
        cell(b.status),
        cell(b.payment_mode),
        cell(b.agent_id),
        cell(b.adults),
        cell(b.rooms),
      ]),
    ),
    sheet(
      "DeparturesDue",
      [
        "id",
        "contact_name",
        "contact_phone",
        "check_in",
        "check_out",
        "status",
        "rooms",
      ],
      (departuresRes.data ?? []).map((b) => {
        const rooms = (
          (b.room_assignments as
            | { room_units: { label?: string } | { label?: string }[] | null }[]
            | null) ?? []
        )
          .map((a) => {
            const u = Array.isArray(a.room_units)
              ? a.room_units[0]
              : a.room_units;
            return u?.label ?? "";
          })
          .filter(Boolean)
          .join(", ");
        return [
          cell(b.id),
          cell(b.contact_name),
          cell(b.contact_phone),
          cell(b.check_in),
          cell(b.check_out),
          cell(b.status),
          rooms,
        ];
      }),
    ),
    sheet(
      "Bookings",
      [
        "id",
        "status",
        "source",
        "contact_name",
        "contact_phone",
        "contact_email",
        "check_in",
        "check_out",
        "payment_mode",
        "guest_origin",
        "guide_number",
        "agent_id",
        "adults",
        "rooms",
        "notes",
        "created_at",
        "guests",
      ],
      bookingRows,
    ),
    sheet(
      "FolioLines",
      [
        "id",
        "folio_id",
        "description",
        "source_type",
        "source_id",
        "amount_btn",
        "gst_btn",
        "total_btn",
        "status",
        "business_date",
        "room_unit_id",
        "reverses_line_id",
        "created_at",
      ],
      (folioLinesRes.data ?? []).map((l) => [
        cell(l.id),
        cell(l.folio_id),
        cell(l.description),
        cell(l.source_type),
        cell(l.source_id),
        cell(l.amount_btn),
        cell(l.gst_btn),
        cell(l.total_btn),
        cell(l.status),
        cell(l.business_date),
        cell(l.room_unit_id),
        cell(l.reverses_line_id),
        cell(l.created_at),
      ]),
    ),
    sheet(
      "Payments",
      [
        "id",
        "folio_id",
        "booking_id",
        "amount_btn",
        "method",
        "reference",
        "notes",
        "created_at",
        "idempotency_key",
      ],
      (paymentsRes.data ?? []).map((p) => [
        cell(p.id),
        cell(p.folio_id),
        cell(p.booking_id),
        cell(p.amount_btn),
        cell(p.method),
        cell(p.reference),
        cell(p.notes),
        cell(p.created_at),
        cell(p.idempotency_key),
      ]),
    ),
    sheet(
      "LaundryOpen",
      [
        "id",
        "guest_name",
        "room",
        "status",
        "total_btn",
        "folio_id",
        "requested_at",
        "items",
        "bags",
      ],
      laundryRows,
    ),
    sheet("Property", propertyKeys, propertyRows),
    sheet(
      "RoomTypes",
      roomTypeKeys,
      rowsFromObjects(
        roomTypesRes.data as Record<string, unknown>[] | null,
        roomTypeKeys,
      ),
    ),
    sheet(
      "Rooms",
      roomKeys,
      rowsFromObjects(roomsRes.data as Record<string, unknown>[] | null, roomKeys),
    ),
    sheet(
      "Seasons",
      seasonKeys,
      rowsFromObjects(
        seasonsRes.data as Record<string, unknown>[] | null,
        seasonKeys,
      ),
    ),
    sheet(
      "Rates",
      rateKeys,
      rowsFromObjects(ratesRes.data as Record<string, unknown>[] | null, rateKeys),
    ),
    sheet(
      "DepositRules",
      depositKeys,
      rowsFromObjects(
        depositRes.data as Record<string, unknown>[] | null,
        depositKeys,
      ),
    ),
    sheet(
      "Outlets",
      outletKeys,
      rowsFromObjects(
        outletsRes.data as Record<string, unknown>[] | null,
        outletKeys,
      ),
    ),
    sheet(
      "MenuItems",
      menuKeys,
      rowsFromObjects(menuRes.data as Record<string, unknown>[] | null, menuKeys),
    ),
    sheet(
      "LaundryCatalog",
      laundryCatKeys,
      rowsFromObjects(
        laundryCatRes.data as Record<string, unknown>[] | null,
        laundryCatKeys,
      ),
    ),
    sheet(
      "Agents",
      agentKeys,
      rowsFromObjects(
        agentsRes.data as Record<string, unknown>[] | null,
        agentKeys,
      ),
    ),
    sheet(
      "Staff",
      staffKeys,
      rowsFromObjects(staffRes.data as Record<string, unknown>[] | null, staffKeys),
    ),
    sheet(
      "DiningTables",
      tableKeys,
      rowsFromObjects(
        tablesRes.data as Record<string, unknown>[] | null,
        tableKeys,
      ),
    ),
  ];

  const buffer = await buildWorkbook({
    title: "Pelbu hotel backup pack",
    propertyName,
    from: from90,
    to: to90,
    sheets,
  });

  const filename = `pelbu-hotel-backup-${slug}-${date}.xlsx`;
  return { buffer, filename, propertySlug: slug };
}
