/**
 * Clean v2 Drizzle schema (REINVENT) — folio per payer, net rates, version, outbox.
 * Applied as Postgres schema `v2` (see migrations/).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const v2 = pgSchema("v2");

const ts = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();

export const organizations = v2.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: ts("created_at"),
});

export const properties = v2.table("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Thimphu"),
  currentBusinessDate: date("current_business_date").notNull(),
  scRate: numeric("sc_rate", { precision: 8, scale: 4 }).notNull().default("0.10"),
  gstRate: numeric("gst_rate", { precision: 8, scale: 4 }).notNull().default("0.05"),
  gstEnabled: boolean("gst_enabled").notNull().default(true),
  baseCurrency: text("base_currency").notNull().default("BTN"),
  deskAccessCodeHash: text("desk_access_code_hash"),
  deskAccessCodeHint: text("desk_access_code_hint"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at"),
});

/** Exclusive agent / guide / driver portal logins (property-scoped). */
export const portalAccounts = v2.table(
  "portal_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    role: text("role").notNull(),
    subjectId: uuid("subject_id").notNull(),
    loginCode: text("login_code").notNull(),
    displayName: text("display_name").notNull(),
    pinHash: text("pin_hash"),
    pinResetRequired: boolean("pin_reset_required").notNull().default(true),
    active: boolean("active").notNull().default(true),
    homeRoute: text("home_route").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("portal_accounts_property_role_code").on(t.propertyId, t.role, t.loginCode)],
);

export const roomTypes = v2.table("room_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  baseOccupancy: integer("base_occupancy").notNull().default(2),
  version: integer("version").notNull().default(1),
});

export const rooms = v2.table(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypes.id),
    number: text("number").notNull(),
    floor: text("floor"),
    hkStatus: text("hk_status").notNull().default("clean"),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("rooms_property_number").on(t.propertyId, t.number)],
);

export const staff = v2.table("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  /** ZKTeco / ADMS badge number — matches ATTLOG pin field. */
  employeeCode: text("employee_code"),
  /** SC tip pool band: 1.0 trainee · 1.5 attendant · 2.0 FO/CDP · 3.0 head. */
  tipPoints: numeric("tip_points", { precision: 8, scale: 2 })
    .notNull()
    .default("1.5"),
  pinHash: text("pin_hash"),
  active: boolean("active").notNull().default(true),
  canLogin: boolean("can_login").notNull().default(false),
  deskRole: text("desk_role"),
  homeRoute: text("home_route").notNull().default("/desk"),
  pinResetRequired: boolean("pin_reset_required").notNull().default(true),
  pinSetAt: timestamp("pin_set_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
});

export const ratePlans = v2.table("rate_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("BTN"),
  mealPlan: text("meal_plan").notNull().default("EP"),
  version: integer("version").notNull().default(1),
});

/** Net-only nightly rate. */
export const rates = v2.table(
  "rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypes.id),
    stayDate: date("stay_date").notNull(),
    netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("rates_plan_type_date").on(t.ratePlanId, t.roomTypeId, t.stayDate),
  ],
);

export const guests = v2.table("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  nationality: text("nationality"),
  passportOrCid: text("passport_or_cid"),
  visaStamp: text("visa_stamp"),
  documentType: text("document_type").notNull().default("passport"),
  vip: boolean("vip").notNull().default(false),
  version: integer("version").notNull().default(1),
});

export const agents = v2.table("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0"),
  creditHold: boolean("credit_hold").notNull().default(false),
  version: integer("version").notNull().default(1),
});

export const groups = v2.table("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  name: text("name").notNull(),
  agentId: uuid("agent_id").references(() => agents.id),
  version: integer("version").notNull().default(1),
});

export const bookings = v2.table("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  confirmationNo: text("confirmation_no").notNull(),
  status: text("status").notNull().default("held"),
  guestId: uuid("guest_id").references(() => guests.id),
  agentId: uuid("agent_id").references(() => agents.id),
  groupId: uuid("group_id").references(() => groups.id),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  source: text("source").notNull().default("desk"),
  notes: text("notes"),
  /** Optional sharing guest on the same room (desk Guests & Docs). */
  companionName: text("companion_name"),
  companionPassportOrCid: text("companion_passport_or_cid"),
  companionNationality: text("companion_nationality"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at"),
});

export const bookingLines = v2.table("booking_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }),
  mealPlan: text("meal_plan").notNull().default("EP"),
  version: integer("version").notNull().default(1),
});

/** Active assignments only participate in exclusion — REINVENT. */
export const roomAssignments = v2.table(
  "room_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    bookingLineId: uuid("booking_line_id")
      .notNull()
      .references(() => bookingLines.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    stayDate: date("stay_date").notNull(),
    active: boolean("active").notNull().default(true),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("room_assignments_room_date").on(t.roomId, t.stayDate, t.active),
  ],
);

/** OOO / OOS / hold windows — StayView rack blocks (half-open [from, to)). */
export const roomBlocks = v2.table(
  "room_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    blockKind: text("block_kind").notNull().default("ooo"),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    reason: text("reason").notNull(),
    createdAt: ts("created_at"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("room_blocks_property_window").on(t.propertyId, t.fromDate, t.toDate),
    index("room_blocks_room_active").on(t.roomId, t.releasedAt),
  ],
);

/** One folio per payer (guest | agent | company). */
export const folios = v2.table("folios", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  payerType: text("payer_type").notNull(),
  guestId: uuid("guest_id").references(() => guests.id),
  agentId: uuid("agent_id").references(() => agents.id),
  currency: text("currency").notNull().default("BTN"),
  status: text("status").notNull().default("open"),
  version: integer("version").notNull().default(1),
});

export const folioLines = v2.table("folio_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  folioId: uuid("folio_id")
    .notNull()
    .references(() => folios.id),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
  scAmount: numeric("sc_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: ts("created_at"),
});

export const payments = v2.table("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  folioId: uuid("folio_id")
    .notNull()
    .references(() => folios.id),
  method: text("method").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BTN"),
  fxRate: numeric("fx_rate", { precision: 14, scale: 6 }),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: ts("created_at"),
});

export const fiscalDocs = v2.table(
  "fiscal_docs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    folioId: uuid("folio_id").references(() => folios.id),
    kind: text("kind").notNull(),
    docNo: text("doc_no").notNull(),
    status: text("status").notNull().default("issued"),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("fiscal_docs_property_no").on(t.propertyId, t.docNo)],
);

export const propertySequences = v2.table(
  "property_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [uniqueIndex("property_sequences_kind_year").on(t.propertyId, t.kind, t.year)],
);

export const events = v2.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  type: text("type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: ts("created_at"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const eventHandlerReceipts = v2.table(
  "event_handler_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    handlerKey: text("handler_key").notNull(),
    processedAt: ts("processed_at"),
  },
  (t) => [uniqueIndex("event_handler_once").on(t.eventId, t.handlerKey)],
);

/** Append-only audit — no UPDATE/DELETE grants in migration. */
export const auditLog = v2.table("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  actorStaffId: uuid("actor_staff_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  createdAt: ts("created_at"),
  prevHash: text("prev_hash"),
  rowHash: text("row_hash"),
});

export const partnerCalendar = v2.table("partner_calendar", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  stayDate: date("stay_date").notNull(),
  roomId: uuid("room_id"),
  state: text("state").notNull(),
  ownerAgentId: uuid("owner_agent_id"),
  guestName: text("guest_name"),
  bookingRef: text("booking_ref"),
});

export const menuItems = v2.table("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  outletId: uuid("outlet_id"),
  name: text("name").notNull(),
  category: text("category"),
  netPrice: numeric("net_price", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
});

export const posOrders = v2.table("pos_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  status: text("status").notNull().default("open"),
  tableId: uuid("table_id"),
  bookingId: uuid("booking_id"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at"),
});

export const hkTasks = v2.table("hk_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  roomId: uuid("room_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  attendantStaffId: uuid("attendant_staff_id"),
  version: integer("version").notNull().default(1),
});

export const cmsPages = v2.table("cms_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  blocks: jsonb("blocks").notNull().default([]),
  version: integer("version").notNull().default(1),
});

export const services = v2.table("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  netPrice: numeric("net_price", { precision: 12, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes"),
  version: integer("version").notNull().default(1),
});

export const banquetEvents = v2.table("banquet_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("enquiry"),
  eventDate: date("event_date"),
  headcount: integer("headcount"),
  version: integer("version").notNull().default(1),
});

/* --- Enterprise ops (procurement, HR hardware, utilities, fleet, banking) --- */

export const cashDrawerShifts = v2.table("cash_drawer_shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  openedByStaffId: uuid("opened_by_staff_id").references(() => staff.id),
  cashierStaffId: uuid("cashier_staff_id").references(() => staff.id),
  openedAt: ts("opened_at"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingFloatBtn: numeric("opening_float_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  expectedBalanceBtn: numeric("expected_balance_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  countedBalanceBtn: numeric("counted_balance_btn", { precision: 14, scale: 2 }),
  closingCashBtn: numeric("closing_cash_btn", { precision: 14, scale: 2 }),
  varianceBtn: numeric("variance_btn", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("open"),
  version: integer("version").notNull().default(1),
});

export const cashDrawerMovements = v2.table(
  "cash_drawer_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    shiftId: uuid("shift_id").notNull().references(() => cashDrawerShifts.id),
    kind: text("kind").notNull(),
    amountBtn: numeric("amount_btn", { precision: 14, scale: 2 }).notNull(),
    direction: text("direction").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    actorStaffId: uuid("actor_staff_id").references(() => staff.id),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("cash_drawer_movements_idem").on(t.propertyId, t.idempotencyKey),
    index("cash_drawer_movements_shift").on(t.shiftId, t.createdAt),
  ],
);

export const procurementAdvances = v2.table(
  "procurement_advances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    shiftId: uuid("shift_id").references(() => cashDrawerShifts.id),
    issuedToStaffId: uuid("issued_to_staff_id").references(() => staff.id),
    issuedByStaffId: uuid("issued_by_staff_id").references(() => staff.id),
    amountBtn: numeric("amount_btn", { precision: 14, scale: 2 }).notNull(),
    purpose: text("purpose").notNull().default("cfm_market"),
    status: text("status").notNull().default("open"),
    changeReturnedBtn: numeric("change_returned_btn", { precision: 14, scale: 2 }).notNull().default("0"),
    spentBtn: numeric("spent_btn", { precision: 14, scale: 2 }).notNull().default("0"),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    drawerMovementOutId: uuid("drawer_movement_out_id").references(() => cashDrawerMovements.id),
    drawerMovementInId: uuid("drawer_movement_in_id").references(() => cashDrawerMovements.id),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: ts("created_at"),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("procurement_advances_idem").on(t.propertyId, t.idempotencyKey)],
);

export const procurementBills = v2.table("procurement_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  advanceId: uuid("advance_id").references(() => procurementAdvances.id),
  billNo: text("bill_no").notNull(),
  billDate: date("bill_date").notNull(),
  supplierName: text("supplier_name").notNull(),
  category: text("category").notNull(),
  taxableBtn: numeric("taxable_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  gstBtn: numeric("gst_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  nonTaxableBtn: numeric("non_taxable_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  grandTotalBtn: numeric("grand_total_btn", { precision: 14, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull(),
  journalNo: text("journal_no"),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("posted"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  createdAt: ts("created_at"),
  version: integer("version").notNull().default(1),
});

export const procurementBillItems = v2.table("procurement_bill_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  billId: uuid("bill_id").notNull().references(() => procurementBills.id),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull().default("kg"),
  unitCostBtn: numeric("unit_cost_btn", { precision: 14, scale: 2 }).notNull(),
  lineTotalBtn: numeric("line_total_btn", { precision: 14, scale: 2 }).notNull(),
  stallNo: text("stall_no"),
});

export const shifts = v2.table("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  graceMinutes: integer("grace_minutes").notNull().default(10),
  active: boolean("active").notNull().default(true),
});

export const attendancePunches = v2.table(
  "attendance_punches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    deviceSn: text("device_sn").notNull(),
    employeeCode: text("employee_code").notNull(),
    staffId: uuid("staff_id").references(() => staff.id),
    punchedAt: timestamp("punched_at", { withTimezone: true }).notNull(),
    punchType: integer("punch_type").notNull().default(0),
    verifyMode: integer("verify_mode").notNull().default(1),
    rawLine: text("raw_line").notNull(),
    shiftId: uuid("shift_id").references(() => shifts.id),
    lateMinutes: integer("late_minutes").notNull().default(0),
    createdAt: ts("created_at"),
  },
  (t) => [
    index("attendance_punches_staff_at").on(t.propertyId, t.employeeCode, t.punchedAt),
    uniqueIndex("attendance_punches_device_line").on(t.propertyId, t.deviceSn, t.rawLine),
    uniqueIndex("attendance_punches_pin_time_uidx").on(
      t.propertyId,
      t.employeeCode,
      t.punchedAt,
    ),
  ],
);

export const scTipPoolRuns = v2.table(
  "sc_tip_pool_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    periodYm: text("period_ym").notNull(),
    /** Calendar mirrors of period_ym (YYYY-MM). */
    month: integer("month"),
    year: integer("year"),
    poolBtn: numeric("pool_btn", { precision: 14, scale: 2 }).notNull(),
    totalPointDays: numeric("total_point_days", { precision: 14, scale: 4 }).notNull(),
    status: text("status").notNull().default("draft"),
    generatedAt: ts("generated_at"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("sc_tip_pool_runs_period").on(t.propertyId, t.periodYm)],
);

export const scTipPoolLines = v2.table("sc_tip_pool_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  runId: uuid("run_id").notNull().references(() => scTipPoolRuns.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  tipPoints: numeric("tip_points", { precision: 8, scale: 2 }).notNull(),
  daysWorked: numeric("days_worked", { precision: 8, scale: 2 }).notNull(),
  pointDays: numeric("point_days", { precision: 14, scale: 4 }).notNull(),
  shareBtn: numeric("share_btn", { precision: 14, scale: 2 }).notNull(),
});

export const salarySlips = v2.table("salary_slips", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  periodYm: text("period_ym").notNull(),
  basicBtn: numeric("basic_btn", { precision: 14, scale: 2 }).notNull(),
  allowancesBtn: numeric("allowances_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  tipShareBtn: numeric("tip_share_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  nppfEmployeeBtn: numeric("nppf_employee_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  gisBtn: numeric("gis_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  citBtn: numeric("cit_btn", { precision: 14, scale: 2 }).notNull().default("0"),
  netPayBtn: numeric("net_pay_btn", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: ts("created_at"),
});

export const utilityMeters = v2.table("utility_meters", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  /** bpc_power | telecom | water | waste */
  kind: text("kind").notNull(),
  consumerNo: text("consumer_no").notNull(),
  meterNo: text("meter_no"),
  label: text("label").notNull(),
  unit: text("unit").notNull().default("kWh"),
  active: boolean("active").notNull().default(true),
});

export const utilityBills = v2.table("utility_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  meterId: uuid("meter_id").notNull().references(() => utilityMeters.id),
  billNo: text("bill_no").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  billingMonth: date("billing_month"),
  units: numeric("units", { precision: 14, scale: 3 }).notNull(),
  amountBtn: numeric("amount_btn", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  receiptNo: text("receipt_no"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  createdAt: ts("created_at"),
});

export const amcContracts = v2.table("amc_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  /** elevator | generator | boiler | exhaust */
  assetKind: text("asset_kind").notNull(),
  vendorName: text("vendor_name").notNull(),
  contractNo: text("contract_no"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  annualBtn: numeric("annual_btn", { precision: 14, scale: 2 }),
  alertDays: integer("alert_days").notNull().default(45),
  active: boolean("active").notNull().default(true),
});

export const amcServiceLogs = v2.table("amc_service_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  contractId: uuid("contract_id").notNull().references(() => amcContracts.id),
  servicedOn: date("serviced_on").notNull(),
  technician: text("technician"),
  notes: text("notes"),
  nextServiceDue: date("next_service_due"),
  createdAt: ts("created_at"),
});

export const tourGuides = v2.table("tour_guides", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  fullName: text("full_name").notNull(),
  tcrLicenseNo: text("tcr_license_no").notNull(),
  phone: text("phone"),
  languages: text("languages").array().notNull().default([]),
  agentId: uuid("agent_id").references(() => agents.id),
  status: text("status").notNull().default("active"),
  active: boolean("active").notNull().default(true),
});

export const fleetVehicles = v2.table("fleet_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  plate: text("plate").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  model: text("model"),
  seats: integer("seats").notNull().default(7),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  rstaExpiry: date("rsta_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  active: boolean("active").notNull().default(true),
});

export const driverDormBeds = v2.table("driver_dorm_beds", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  bedLabel: text("bed_label").notNull(),
  floor: text("floor"),
  occupiedByName: text("occupied_by_name"),
  vehicleId: uuid("vehicle_id").references(() => fleetVehicles.id),
  guideId: uuid("guide_id").references(() => tourGuides.id),
  assignedGroupId: uuid("assigned_group_id"),
  nightlyRateBtn: numeric("nightly_rate_btn", { precision: 10, scale: 2 }),
  fromDate: date("from_date"),
  toDate: date("to_date"),
  /** vacant | occupied | ooo | free (legacy) */
  status: text("status").notNull().default("free"),
});

export const bankStatements = v2.table("bank_statements", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  /** bob | bnb | drukpnb | tbank */
  bankCode: text("bank_code").notNull(),
  accountLabel: text("account_label").notNull(),
  statementDate: date("statement_date").notNull(),
  closingBalanceBtn: numeric("closing_balance_btn", { precision: 14, scale: 2 }),
  sourceFilename: text("source_filename"),
  status: text("status").notNull().default("imported"),
  createdAt: ts("created_at"),
});

export const bankStatementLines = v2.table(
  "bank_statement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    statementId: uuid("statement_id").notNull().references(() => bankStatements.id),
    txnDate: date("txn_date").notNull(),
    description: text("description").notNull(),
    /** Absolute amount (legacy); prefer debit_btn / credit_btn from parsers. */
    amountBtn: numeric("amount_btn", { precision: 14, scale: 2 }).notNull(),
    direction: text("direction").notNull(),
    debitBtn: numeric("debit_btn", { precision: 14, scale: 2 }).notNull().default("0"),
    creditBtn: numeric("credit_btn", { precision: 14, scale: 2 }).notNull().default("0"),
    balanceBtn: numeric("balance_btn", { precision: 14, scale: 2 }),
    externalRef: text("external_ref"),
    fingerprint: text("fingerprint"),
    status: text("status").notNull().default("open"),
  },
  (t) => [
    uniqueIndex("bank_statement_lines_fingerprint")
      .on(t.propertyId, t.fingerprint)
      .where(sql`${t.fingerprint} is not null`),
  ],
);

export const reconciliationMatches = v2.table("reconciliation_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  statementLineId: uuid("statement_line_id").notNull().references(() => bankStatementLines.id),
  matchKind: text("match_kind").notNull(),
  matchEntityId: uuid("match_entity_id").notNull(),
  amountBtn: numeric("amount_btn", { precision: 14, scale: 2 }).notNull(),
  matchedAt: ts("matched_at"),
  matchedByStaffId: uuid("matched_by_staff_id").references(() => staff.id),
});

export const dotStarAudits = v2.table("dot_star_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  auditDate: date("audit_date").notNull(),
  starTarget: integer("star_target").notNull().default(4),
  score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
  grade: text("grade").notNull().default("pending"),
  auditorName: text("auditor_name"),
  notes: text("notes"),
  createdAt: ts("created_at"),
  version: integer("version").notNull().default(1),
});

export const dotStarCriteria = v2.table("dot_star_criteria", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  auditId: uuid("audit_id").notNull().references(() => dotStarAudits.id),
  code: text("code").notNull(),
  label: text("label").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull().default("1"),
  met: boolean("met").notNull().default(false),
  evidenceUrl: text("evidence_url"),
});

/** Hotel Hermes — Telegram pairing + guest doc OCR (Wave 1). */
export const telegramPairTokens = v2.table("telegram_pair_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  token: text("token").notNull().unique(),
  role: text("role").notNull().default("fo"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedChatId: bigint("used_chat_id", { mode: "number" }),
  createdAt: ts("created_at"),
});

export const telegramChats = v2.table("telegram_chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  chatType: text("chat_type").notNull().default("private"),
  role: text("role").notNull().default("fo"),
  status: text("status").notNull().default("active"),
  displayName: text("display_name"),
  tgUsername: text("tg_username"),
  pairedAt: ts("paired_at"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const telegramEvents = v2.table("telegram_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  chatId: bigint("chat_id", { mode: "number" }),
  direction: text("direction").notNull().default("in"),
  intent: text("intent").notNull().default("unknown"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: ts("created_at"),
});

export const telegramDocDrafts = v2.table("telegram_doc_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  ocr: jsonb("ocr").notNull().default({}),
  imageRef: text("image_ref"),
  suggestedStayId: uuid("suggested_stay_id"),
  appliedStayId: uuid("applied_stay_id"),
  createdByChatId: bigint("created_by_chat_id", { mode: "number" }),
  createdAt: ts("created_at"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
});
