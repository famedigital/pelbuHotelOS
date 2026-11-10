"use server";

import { confirmCheckIn, confirmCheckOut } from "@/app/actions/erp-checkin";
import { cancelBooking } from "@/app/actions/erp-channel";
import { createCalendarReservation } from "@/app/actions/erp-calendar";
import { postMinibarCharge } from "@/app/actions/erp-folio-minibar";
import { issueFolioInvoice, postFolioRoomNight, runNightAudit } from "@/app/actions/erp-folio-ops";
import { postGuestLaundrySlip } from "@/app/actions/erp-laundry-slip";
import { postFolioPayment } from "@/app/actions/erp-pos";
import { assignBookingRoomUnit } from "@/app/actions/erp-reservations-party";
import { writeAuditEvent } from "@/lib/audit";
import {
  GEMINI_CONSENT_SYSTEM,
  generateGeminiJsonFast,
  loadGeminiByok,
} from "@/lib/ai/gemini-byok";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postStayExtraMattress } from "@/lib/folio/extra-bed";
import {
  INNORA_PAGES,
  isInnoraPage,
  likeNeedle,
  matchStay,
  parseInnoraIntent,
  type InnoraIntent,
  type InnoraStayStep,
} from "@/lib/ai/innora-fast-route";
import { dayClosePreview, planDayClose, type DayCloseStay } from "@/lib/ai/innora-day-close";
import { ensureOpenFolio } from "@/lib/folio/open-folio";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InnoraChatTurn = {
  role: "user" | "innora";
  text: string;
};

export type InnoraActionKind =
  | "checkout"
  | "open_folio"
  | "post_room_night"
  | "post_bill_addon"
  | "show_folio"
  | "close_through_today"
  | "check_in"
  | "cancel_stay"
  | "move_room"
  | "take_payment"
  | "issue_invoice"
  | "night_audit"
  | "reserve_stay";

export type InnoraPendingAction = {
  kind: InnoraActionKind;
  bookingId?: string;
  label: string;
  addon?: "mattress" | "laundry" | "service";
  qty?: number;
  speed?: "same_day" | "overnight" | "express";
  catalogItemId?: string;
  serviceItemId?: string;
  roomUnitId?: string;
  roomLabel?: string;
  amountBtn?: number;
  method?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
};

export type InnoraOpenStay = {
  bookingId: string;
  step: InnoraStayStep | null;
};

export type InnoraChatResult =
  | {
      ok: true;
      reply: string;
      action: InnoraPendingAction | null;
      href?: string;
      lines?: string[];
      openStay?: InnoraOpenStay | null;
    }
  | { ok: false; error: string };

export type InnoraRunResult = {
  ok: boolean;
  message: string;
  href?: string;
};

type StaySnap = {
  id: string;
  name: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  rooms: string;
  units: { id: string; label: string }[];
  folioId: string | null;
};

const KINDS = new Set<InnoraActionKind>([
  "checkout",
  "open_folio",
  "post_room_night",
  "post_bill_addon",
  "show_folio",
  "close_through_today",
  "check_in",
  "cancel_stay",
  "move_room",
  "take_payment",
  "issue_invoice",
  "night_audit",
  "reserve_stay",
]);

async function requireDeskProperty() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  return { admin, propertyId };
}

function assignmentUnits(row: Record<string, unknown>): { id: string; label: string }[] {
  const assigns = row.room_assignments;
  if (!Array.isArray(assigns)) return [];
  const units: { id: string; label: string }[] = [];
  for (const item of assigns) {
    if (!item || typeof item !== "object") continue;
    const raw = item as {
      room_unit_id?: string;
      room_units?: { id?: string; label?: string } | { id?: string; label?: string }[];
    };
    const unit = Array.isArray(raw.room_units) ? raw.room_units[0] : raw.room_units;
    const id = unit?.id?.trim() || raw.room_unit_id?.trim() || "";
    const label = unit?.label?.trim() || "";
    if (id && label) units.push({ id, label });
  }
  return units;
}

function roomLabel(row: Record<string, unknown>): string {
  return assignmentUnits(row)
    .map((unit) => unit.label)
    .join(", ");
}

async function loadStaySnaps(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<StaySnap[]> {
  const { data } = await admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, status, check_in, check_out, room_assignments(room_unit_id, room_units(id, label)), folios(id, status)",
    )
    .eq("property_id", propertyId)
    .in("status", ["checked_in", "confirmed", "pending"])
    .order("check_out", { ascending: false })
    .limit(500);

  return (data ?? []).map((row) => {
    const folios = (row.folios as { id?: string; status?: string }[] | null) ?? [];
    const open = folios.find((folio) => folio.status === "open") ?? folios[0];
    return {
      id: row.id as string,
      name: String(row.contact_name ?? "Guest"),
      code: String(row.confirmation_code ?? ""),
      status: String(row.status ?? ""),
      checkIn: String(row.check_in ?? "").slice(0, 10),
      checkOut: String(row.check_out ?? "").slice(0, 10),
      rooms: roomLabel(row as Record<string, unknown>),
      units: assignmentUnits(row as Record<string, unknown>),
      folioId: (open?.id as string | undefined) ?? null,
    };
  });
}

function billLine(row: {
  contact_name?: string | null;
  status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  folios?: {
    fiscal_documents?: { doc_no?: string; doc_kind?: string; status?: string }[] | null;
  }[] | null;
}): string {
  const folios = row.folios ?? [];
  const docs = folios.flatMap((folio) => folio.fiscal_documents ?? []);
  const invoice = docs.find(
    (doc) => doc.doc_kind === "invoice" && doc.status === "issued",
  );
  const who = String(row.contact_name ?? "Guest");
  const when = [row.check_in, row.check_out]
    .map((day) => String(day ?? "").slice(5, 10))
    .filter(Boolean)
    .join("–");
  const head = invoice?.doc_no || "No bill number yet";
  return [head, who, when, row.status].filter(Boolean).join(" · ");
}

async function findBills(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  query: string,
): Promise<InnoraChatResult> {
  const needle = likeNeedle(query);
  const { data: agents } = await admin
    .from("agents")
    .select("id, company_name")
    .ilike("company_name", needle)
    .order("company_name")
    .limit(6);

  const named = agents ?? [];
  let chosen = named;
  if (named.length > 1) {
    const ids = named.map((agent) => agent.id as string);
    const { data: stayRows } = await admin
      .from("bookings")
      .select("agent_id")
      .eq("property_id", propertyId)
      .in("agent_id", ids)
      .limit(300);
    const withStays = new Set(
      (stayRows ?? []).map((row) => row.agent_id as string),
    );
    const onHotel = named.filter((agent) => withStays.has(agent.id as string));
    if (onHotel.length) chosen = onHotel;
  }

  const wanted = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = chosen.filter(
    (agent) =>
      String(agent.company_name).toLowerCase().replace(/[^a-z0-9]/g, "") ===
      wanted,
  );
  if (exact.length) chosen = exact;

  if (chosen.length > 1) {
    const sameName =
      new Set(
        chosen.map((agent) =>
          String(agent.company_name).toLowerCase().replace(/[^a-z0-9]/g, ""),
        ),
      ).size === 1;
    if (!sameName) {
      return {
        ok: true,
        reply: "More than one partner matches. Say the full name.",
        action: null,
        lines: chosen.map((agent) => String(agent.company_name)),
      };
    }
  }

  const agent = chosen[0];
  if (agent) {
    const ids = chosen.map((row) => row.id as string);
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        "agent_id, contact_name, status, check_in, check_out, folios(fiscal_documents(doc_no, doc_kind, status))",
      )
      .eq("property_id", propertyId)
      .in("agent_id", ids)
      .order("check_out", { ascending: false })
      .limit(30);
    const lines = (bookings ?? []).map((row) => billLine(row));
    const tally = new Map<string, number>();
    for (const row of bookings ?? []) {
      const id = row.agent_id as string;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    const bestId =
      [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      (agent.id as string);
    return {
      ok: true,
      reply: lines.length
        ? `${agent.company_name}: ${lines.length} stay${lines.length === 1 ? "" : "s"} on the money page.`
        : `${agent.company_name} has no stays on this hotel.`,
      action: null,
      href: `/erp/agents/${bestId}?tab=money`,
      lines,
    };
  }

  const { data: guests } = await admin
    .from("bookings")
    .select(
      "id, contact_name, status, check_in, check_out, folios(id, fiscal_documents(doc_no, doc_kind, status))",
    )
    .eq("property_id", propertyId)
    .ilike("contact_name", needle)
    .order("check_out", { ascending: false })
    .limit(8);
  if (!guests?.length) {
    return {
      ok: true,
      reply: `No partner or guest named “${query}” on this hotel.`,
      action: null,
    };
  }
  const lines = guests.map((row) => billLine(row));
  const folioId = (
    guests[0]?.folios as { id?: string }[] | null | undefined
  )?.[0]?.id;
  return {
    ok: true,
    reply: lines.length === 1 ? lines[0]! : `${lines.length} stays match.`,
    action: null,
    href: folioId ? `/erp/folios/${folioId}` : "/erp/bills?tab=stay",
    lines: lines.length === 1 ? undefined : lines,
  };
}

async function openMasterBill(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  query: string,
): Promise<InnoraChatResult> {
  const needle = likeNeedle(query);
  const { data: folios } = await admin
    .from("folios")
    .select("id, label, status")
    .eq("property_id", propertyId)
    .eq("folio_type", "master")
    .ilike("label", needle)
    .order("created_at", { ascending: false })
    .limit(8);

  const matches = folios ?? [];
  if (!matches.length) {
    return {
      ok: true,
      reply: `No master bill named “${query}” on this hotel.`,
      action: null,
    };
  }
  if (matches.length > 1) {
    return {
      ok: true,
      reply: "More than one master bill matches. Say more of the name.",
      action: null,
      lines: matches.map((folio) => String(folio.label)),
    };
  }

  const folio = matches[0]!;
  return {
    ok: true,
    reply: `Opening ${folio.label}.`,
    action: null,
    href: `/erp/folios/${folio.id}/statement`,
  };
}

function boardFor(stay: StaySnap, step: InnoraStayStep | null): string {
  if (step === "check_out") return "/erp/departures";
  if (step === "check_in") return "/erp/arrivals";
  if (stay.status === "checked_in") return "/erp/in-house";
  return "/erp/reservations";
}

function presentStay(
  stay: StaySnap,
  step: InnoraStayStep | null,
  cancel: boolean,
): InnoraChatResult {
  const who = stay.rooms ? `${stay.name} · room ${stay.rooms}` : stay.name;
  const when = [stay.checkIn, stay.checkOut].filter(Boolean).join(" → ");
  const head = [who, when, stay.status].filter(Boolean).join(" · ");
  const reply = cancel
    ? `${head}. The stay card is open. Cancel it there. Chat will not delete a stay.`
    : step === "check_in"
      ? `${head}. Check-in is open on the stay card.`
      : step === "stay_money"
        ? `${head}. The bill is open on the stay card. Save the change there.`
        : step === "check_out"
          ? `${head}. Check-out is open on the stay card.`
          : `${head}. The stay card is open.`;
  return {
    ok: true,
    reply,
    action: null,
    href: boardFor(stay, step),
    openStay: { bookingId: stay.id, step },
  };
}

async function stayJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  kind: InnoraActionKind,
  query: string,
  present?: { step: InnoraStayStep | null; cancel: boolean },
): Promise<InnoraChatResult> {
  const stays = await loadStaySnaps(admin, propertyId);
  const hits = matchStay(stays, query);
  if (hits.length !== 1) {
    return {
      ok: true,
      reply:
        hits.length === 0
          ? `No in-house or arriving stay matches “${query}”.`
          : "More than one stay matches. Say the room.",
      action: null,
      lines: hits.map((stay) =>
        [stay.rooms && `Room ${stay.rooms}`, stay.name, stay.status]
          .filter(Boolean)
          .join(" · "),
      ),
    };
  }
  const stay = hits[0]!;
  if (present) return presentStay(stay, present.step, present.cancel);
  const step: InnoraStayStep =
    kind === "check_in"
      ? "check_in"
      : kind === "checkout" || kind === "issue_invoice"
        ? "check_out"
        : "stay_money";
  const label = actionLabel(kind, stay);
  return {
    ok: true,
    reply: `${label}. Press Confirm.`,
    action: { kind, bookingId: stay.id, label },
    href: boardFor(stay, step),
    openStay: { bookingId: stay.id, step },
  };
}

async function businessDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<string> {
  const { data } = await admin
    .from("properties")
    .select("current_business_date")
    .eq("id", propertyId)
    .maybeSingle();
  const day = String(data?.current_business_date ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" });
}

async function loadDayCloseStays(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<DayCloseStay[]> {
  const bookings: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("bookings")
      .select(
        "id, confirmation_code, contact_name, status, check_in, check_out, agent_id, guide_sign_status",
      )
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    bookings.push(...((data ?? []) as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }

  const withFolio = new Set<string>();
  const ids = bookings.map((row) => String(row.id));
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    if (!slice.length) continue;
    const { data, error } = await admin
      .from("folios")
      .select("booking_id")
      .in("booking_id", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) withFolio.add(String(row.booking_id));
  }

  return bookings.map((row) => ({
    id: String(row.id),
    name: String(row.contact_name ?? "Guest"),
    code: String(row.confirmation_code ?? ""),
    status: String(row.status ?? ""),
    checkIn: String(row.check_in ?? "").slice(0, 10),
    checkOut: String(row.check_out ?? "").slice(0, 10),
    agentId: (row.agent_id as string | null) ?? null,
    guideSign: (row.guide_sign_status as string | null) ?? null,
    hasFolio: withFolio.has(String(row.id)),
  }));
}

async function previewDayClose(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<InnoraChatResult> {
  const today = await businessDay(admin, propertyId);
  const changes = planDayClose(await loadDayCloseStays(admin, propertyId), today);
  const preview = dayClosePreview(changes, today);
  if (!changes.length) {
    return { ok: true, reply: preview.reply, action: null, lines: preview.lines };
  }
  return {
    ok: true,
    reply: preview.reply,
    action: { kind: "close_through_today", label: "Confirm this update" },
    lines: preview.lines,
  };
}

async function applyDayClose(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<InnoraRunResult> {
  const today = await businessDay(admin, propertyId);
  const changes = planDayClose(await loadDayCloseStays(admin, propertyId), today);
  if (!changes.length) {
    return {
      ok: true,
      message: `Through ${today} nothing needed a change. No invoice was created.`,
      href: "/erp/today",
    };
  }

  let checkout = 0;
  let arrival = 0;
  let house = 0;
  let folios = 0;
  let failed = 0;
  for (const change of changes) {
    try {
      if (change.action === "checkout") {
        const patch: Record<string, string | null> = {
          status: "checked_out",
          checked_out_at: `${change.checkOut}T11:00:00+06:00`,
        };
        if (change.waiveGuide) patch.guide_sign_status = "waived";
        const { error } = await admin
          .from("bookings")
          .update(patch)
          .eq("id", change.id)
          .eq("property_id", propertyId);
        if (error) throw new Error(error.message);
        if (change.wasInHouse) {
          const { error: relErr } = await admin.rpc("desk_release_check_out_rooms", {
            p_property_id: propertyId,
            p_booking_id: change.id,
          });
          if (relErr) throw new Error(relErr.message);
        }
        checkout += 1;
      } else if (change.action === "arrival") {
        const { error } = await admin
          .from("bookings")
          .update({ status: "confirmed", checked_out_at: null })
          .eq("id", change.id)
          .eq("property_id", propertyId);
        if (error) throw new Error(error.message);
        arrival += 1;
      } else if (change.action === "in_house") {
        const { error } = await admin
          .from("bookings")
          .update({
            status: "checked_in",
            checked_in_at: `${change.checkIn}T08:00:00+06:00`,
            checked_out_at: null,
          })
          .eq("id", change.id)
          .eq("property_id", propertyId);
        if (error) throw new Error(error.message);
        house += 1;
      }
      if (change.needsFolio) {
        await ensureOpenFolio(admin, propertyId, change.id, change.name || change.code);
        folios += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(
        "innora day close",
        change.code,
        error instanceof Error ? error.message : error,
      );
    }
  }

  await writeAuditEvent(admin, {
    propertyId,
    action: "ai.desk_action",
    entityType: "bookings",
    entityId: propertyId,
    summary: `Innora confirmed the desk through ${today}`,
    meta: { checkout, arrival, house, folios, failed, invoices: 0 },
  });

  const message = `Through ${today}: checked out ${checkout}, arrivals ${arrival}, in house ${house}, folios opened ${folios}. No invoice was created.${failed ? ` ${failed} did not finish.` : ""}`;
  return { ok: failed === 0, message, href: "/erp/today" };
}

function pickUnit(
  stay: StaySnap,
  query: string,
): { id: string; label: string } | "ask" | "none" {
  if (!stay.units.length) return "none";
  const q = query.toLowerCase().replace(/^room\s+/, "").trim();
  const byLabel = stay.units.filter((unit) => unit.label.toLowerCase() === q);
  if (byLabel.length === 1) return byLabel[0]!;
  if (stay.units.length === 1) return stay.units[0]!;
  return "ask";
}

function matchNamed<T extends { name: string }>(rows: T[], item: string): T[] {
  const words = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const q = words(item);
  const singular = q.endsWith("s") && q.length > 3 ? q.slice(0, -1) : q;
  const named = rows.map((row) => ({ row, name: words(row.name) }));
  const exact = named.filter((entry) => entry.name === q || entry.name === singular);
  if (exact.length) return exact.map((entry) => entry.row);
  return named
    .filter((entry) => {
      const name = entry.name;
      return (
        name.includes(singular) ||
        (name.length >= 3 && singular.includes(name))
      );
    })
    .map((entry) => entry.row);
}

async function billAddonJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  intent: Extract<InnoraIntent, { type: "post_bill_addon" }>,
): Promise<InnoraChatResult> {
  if (!intent.query) {
    const need =
      intent.addon === "mattress"
        ? "Say the room or the guest. For example: add extra mattress for room 207."
        : intent.addon === "laundry"
          ? "Say the item and the room. For example: add laundry shirt for room 207."
          : "Say the item and the room. For example: add minibar water for room 207.";
    return { ok: true, reply: need, action: null };
  }
  if (intent.addon !== "mattress" && !intent.item) {
    return {
      ok: true,
      reply:
        intent.addon === "laundry"
          ? "Say the laundry item and the room. For example: add laundry shirt for room 207."
          : "Say the minibar or amenity and the room. For example: add minibar water for room 207.",
      action: null,
    };
  }

  const stays = await loadStaySnaps(admin, propertyId);
  const hits = matchStay(stays, intent.query);
  if (hits.length !== 1) {
    return {
      ok: true,
      reply:
        hits.length === 0
          ? `No in-house or arriving stay matches “${intent.query}”.`
          : "More than one stay matches. Say the room.",
      action: null,
      lines: hits.map((stay) =>
        [stay.rooms && `Room ${stay.rooms}`, stay.name, stay.status]
          .filter(Boolean)
          .join(" · "),
      ),
    };
  }
  const stay = hits[0]!;
  if (stay.status !== "checked_in") {
    return {
      ok: true,
      reply: `${stay.name} is not in house. Check them in, then add it to the bill.`,
      action: null,
      href: boardFor(stay, "check_in"),
      openStay: { bookingId: stay.id, step: "check_in" },
    };
  }

  const who = stay.rooms ? `${stay.name} · room ${stay.rooms}` : stay.name;
  let label = "";
  let catalogItemId: string | undefined;
  let serviceItemId: string | undefined;
  let roomUnitId: string | undefined;

  if (intent.addon === "laundry" || intent.addon === "service") {
    const unit = pickUnit(stay, intent.query);
    if (unit === "none") {
      return {
        ok: true,
        reply: `Assign a room for ${stay.name}, then add this to the bill.`,
        action: null,
        openStay: { bookingId: stay.id, step: "stay_money" },
      };
    }
    if (unit === "ask") {
      return {
        ok: true,
        reply: `${stay.name} has more than one room. Say the room number.`,
        action: null,
        lines: stay.units.map((row) => `Room ${row.label}`),
        openStay: { bookingId: stay.id, step: "stay_money" },
      };
    }
    roomUnitId = unit.id;
  }

  if (intent.addon === "laundry") {
    const { data, error } = await admin
      .from("laundry_catalog_items")
      .select("id, name")
      .eq("property_id", propertyId)
      .eq("is_active", true);
    if (error) return { ok: true, reply: "Could not read laundry prices.", action: null };
    const matches = matchNamed(
      (data ?? []).map((row) => ({ id: row.id as string, name: String(row.name) })),
      intent.item,
    );
    if (matches.length !== 1) {
      return {
        ok: true,
        reply: matches.length
          ? "More than one laundry price matches. Say the full item name."
          : `No laundry price named “${intent.item}”. Add it under Rooms → Laundry → Pricing.`,
        action: null,
        lines: matches.map((row) => row.name),
      };
    }
    catalogItemId = matches[0]!.id;
    label = `Post laundry ${matches[0]!.name} × ${intent.qty} for ${who}`;
  } else if (intent.addon === "service") {
    const { data, error } = await admin
      .from("property_minibar_items")
      .select("id, label")
      .eq("property_id", propertyId)
      .eq("is_active", true);
    if (error) return { ok: true, reply: "Could not read other services.", action: null };
    const matches = matchNamed(
      (data ?? []).map((row) => ({ id: row.id as string, name: String(row.label) })),
      intent.item,
    );
    if (matches.length !== 1) {
      return {
        ok: true,
        reply: matches.length
          ? "More than one service matches. Say the full name."
          : `No minibar or amenity named “${intent.item}”.`,
        action: null,
        lines: matches.map((row) => row.name),
      };
    }
    serviceItemId = matches[0]!.id;
    label = `Post ${matches[0]!.name} × ${intent.qty} for ${who}`;
  } else {
    label = `Post extra mattress × ${intent.qty} for ${who}`;
  }

  return {
    ok: true,
    reply: label,
    action: {
      kind: "post_bill_addon",
      bookingId: stay.id,
      label,
      addon: intent.addon,
      qty: intent.qty,
      speed: intent.speed,
      catalogItemId,
      serviceItemId,
      roomUnitId,
    },
    href: boardFor(stay, "stay_money"),
    openStay: { bookingId: stay.id, step: "stay_money" },
  };
}

async function runFastDesk(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  intent: InnoraIntent,
): Promise<InnoraChatResult> {
  if (intent.type === "close_through_today") {
    return previewDayClose(admin, propertyId);
  }
  if (intent.type === "open_page") {
    return {
      ok: true,
      reply: `Opening ${intent.label}.`,
      action: null,
      href: intent.href,
    };
  }
  if (intent.type === "find_bills") {
    return findBills(admin, propertyId, intent.query);
  }
  if (intent.type === "open_master") {
    return openMasterBill(admin, propertyId, intent.query);
  }
  if (intent.type === "open_stay") {
    return stayJob(admin, propertyId, "show_folio", intent.query, {
      step: intent.step,
      cancel: intent.cancel,
    });
  }
  if (intent.type === "open_folio") {
    return stayJob(admin, propertyId, "show_folio", intent.query, {
      step: "stay_money",
      cancel: false,
    });
  }
  if (intent.type === "post_bill_addon") {
    return billAddonJob(admin, propertyId, intent);
  }
  if (intent.type === "night_audit") {
    return {
      ok: true,
      reply: "I will run night audit for the open business date. That posts room nights and moves the hotel date. Press Confirm.",
      action: { kind: "night_audit", label: "Confirm night audit" },
    };
  }
  if (intent.type === "reserve_stay") {
    return {
      ok: true,
      reply: `I will reserve ${intent.name}, room ${intent.room}, ${intent.checkIn} to ${intent.checkOut}. Phone and guide can be filled later. Press Confirm.`,
      action: {
        kind: "reserve_stay",
        label: `Reserve ${intent.name}`,
        guestName: intent.name,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        roomLabel: intent.room,
      },
    };
  }
  if (intent.type === "check_in_guest") {
    return stayJob(admin, propertyId, "check_in", intent.query);
  }
  if (intent.type === "cancel_stay") {
    return stayJob(admin, propertyId, "cancel_stay", intent.query);
  }
  if (intent.type === "issue_invoice") {
    return stayJob(admin, propertyId, "issue_invoice", intent.query);
  }
  if (intent.type === "move_room") {
    const proposed = await stayJob(admin, propertyId, "move_room", intent.query);
    if (proposed.ok && proposed.action) {
      proposed.action.roomLabel = intent.room;
      proposed.action.label = `Move to room ${intent.room}`;
      proposed.reply = `${proposed.reply} New room ${intent.room}.`;
    }
    return proposed;
  }
  if (intent.type === "take_payment") {
    const proposed = await stayJob(admin, propertyId, "take_payment", intent.query);
    if (proposed.ok && proposed.action) {
      proposed.action.amountBtn = intent.amount;
      proposed.action.method = intent.method;
      proposed.action.label = `Collect Nu ${intent.amount} ${intent.method === "bank_qr" ? "QR" : intent.method}`;
      proposed.reply = `${proposed.action.label}. Press Confirm.`;
    }
    return proposed;
  }
  const kind: InnoraActionKind =
    intent.type === "checkout" ? "checkout" : "post_room_night";
  return stayJob(admin, propertyId, kind, intent.query);
}

function actionLabel(kind: InnoraActionKind, stay: StaySnap): string {
  const who = stay.rooms ? `${stay.name} · room ${stay.rooms}` : stay.name;
  if (kind === "checkout") return `Check out ${who}. Guide number is not required`;
  if (kind === "check_in") return `Check in ${who}. ID and guide can be filled later`;
  if (kind === "cancel_stay") return `Cancel ${who}`;
  if (kind === "move_room") return `Move ${who}`;
  if (kind === "take_payment") return `Take payment for ${who}`;
  if (kind === "issue_invoice") return `Issue a tax invoice for ${who}`;
  if (kind === "open_folio") return `Open a folio for ${who}`;
  if (kind === "post_room_night") return `Post the room night for ${who}`;
  return `Open the folio for ${who}`;
}

export async function askInnoraDesk(input: {
  messages: InnoraChatTurn[];
}): Promise<InnoraChatResult> {
  try {
    const { admin, propertyId } = await requireDeskProperty();
    const turns = input.messages
      .slice(-8)
      .map((turn) => ({
        role: turn.role,
        text: turn.text.slice(0, 1500),
      }))
      .filter((turn) => turn.text.trim());
    if (!turns.length || turns[turns.length - 1]?.role !== "user") {
      return { ok: false, error: "Type what you want done." };
    }

    const latest = turns[turns.length - 1]?.text ?? "";
    const followUp = /^(do that|do it|yes|yes do that|go ahead|ok|okay)$/.test(
      latest.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(),
    );
    const said = followUp
      ? ([...turns]
          .reverse()
          .find(
            (turn) =>
              turn.role === "user" &&
              turn.text.trim().toLowerCase() !== latest.trim().toLowerCase(),
          )?.text ?? latest)
      : latest;
    const intent = parseInnoraIntent(said);
    if (intent) return runFastDesk(admin, propertyId, intent);

    const byok = await loadGeminiByok(admin, propertyId);
    if (!byok.apiKey) {
      return {
        ok: true,
        reply:
          "Say the desk job in plain words: add extra mattress for room 207, add laundry shirt for room 207, add minibar water for room 207, or find bills of Soul Trips.",
        action: null,
      };
    }

    const stays = await loadStaySnaps(admin, propertyId);
    const pages = INNORA_PAGES.map((page) => ({ href: page.href, label: page.label }));
    const roster = stays.slice(0, 40).map((stay) => ({
      id: stay.id,
      name: stay.name,
      room: stay.rooms,
      status: stay.status,
    }));
    const result = await generateGeminiJsonFast({
      apiKey: byok.apiKey,
      model: byok.model,
      system: `${GEMINI_CONSENT_SYSTEM}
You walk the existing desk. You do not write code, SQL, or new screens.
Return ONLY JSON:
{"reply": string, "href": string|null, "bookingId": string|null, "step": "reserve"|"check_in"|"stay_money"|"check_out"|null}
href must be copied from pages. bookingId must be copied from stays.
Open the stay card for create, edit, save, or change on a guest. Do not delete, void, or post money.
If two guests match, leave bookingId null and ask for the room.`,
      user: JSON.stringify({ pages, stays: roster, messages: turns }),
    });
    if (!result.ok) {
      return {
        ok: true,
        reply: `I couldn't finish that. ${result.error}`,
        action: null,
      };
    }

    const data = result.data as {
      reply?: unknown;
      href?: unknown;
      bookingId?: unknown;
      step?: unknown;
    };
    const reply =
      typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim().slice(0, 400)
        : "Tell me the guest or the room.";
    const bookingId =
      typeof data.bookingId === "string" ? data.bookingId.trim() : "";
    const stay = stays.find((row) => row.id === bookingId);
    const step =
      typeof data.step === "string" &&
      (data.step === "reserve" ||
        data.step === "check_in" ||
        data.step === "stay_money" ||
        data.step === "check_out")
        ? data.step
        : null;
    const href =
      typeof data.href === "string" && isInnoraPage(data.href) ? data.href : undefined;
    if (!stay) return { ok: true, reply, action: null, href };

    return {
      ok: true,
      reply,
      action:
        step === "check_out"
          ? {
              kind: "checkout",
              bookingId: stay.id,
              label: actionLabel("checkout", stay),
            }
          : null,
      href: boardFor(stay, step),
      openStay: { bookingId: stay.id, step },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Innora could not answer.",
    };
  }
}

async function runBillAddon(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  args: {
    bookingId: string;
    name: string;
    status: string;
    addon?: "mattress" | "laundry" | "service";
    qty?: number;
    speed?: "same_day" | "overnight" | "express";
    catalogItemId?: string;
    serviceItemId?: string;
    roomUnitId?: string;
  },
): Promise<InnoraRunResult> {
  if (args.status !== "checked_in") {
    return { ok: false, message: `${args.name} is not in house.` };
  }
  const qty = Math.floor(Number(args.qty) || 0);
  if (qty < 1 || qty > 20) {
    return { ok: false, message: "Say a quantity from 1 to 20." };
  }
  if (args.addon === "mattress" || args.addon === "service") {
    await requireMoneyDesk();
  }
  const folioId = await ensureOpenFolio(admin, propertyId, args.bookingId, args.name);

  if (args.addon === "mattress") {
    const { data: property } = await admin
      .from("properties")
      .select("current_business_date")
      .eq("id", propertyId)
      .maybeSingle();
    const businessDate =
      String(property?.current_business_date ?? "").slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    const posted = await postStayExtraMattress(admin, propertyId, {
      folioId,
      bookingId: args.bookingId,
      qty,
      businessDate,
    });
    await writeAuditEvent(admin, {
      propertyId,
      action: "ai.desk_action",
      entityType: "folios",
      entityId: folioId,
      summary: `Innora posted extra mattress × ${qty} for ${args.name}`,
      meta: { kind: "post_bill_addon", addon: "mattress", qty, totalBtn: posted.totalBtn },
    });
    return { ok: true, message: `Extra mattress × ${qty} posted for ${args.name}.` };
  }

  if (args.addon === "laundry") {
    if (!args.catalogItemId || !args.roomUnitId) {
      return { ok: false, message: "Say the laundry item and the room again." };
    }
    const { data: assignment } = await admin
      .from("room_assignments")
      .select("id")
      .eq("booking_id", args.bookingId)
      .eq("room_unit_id", args.roomUnitId)
      .limit(1)
      .maybeSingle();
    if (!assignment) {
      return { ok: false, message: "That room is not on this stay." };
    }
    const formData = new FormData();
    formData.set("booking_id", args.bookingId);
    formData.set("room_unit_id", args.roomUnitId);
    formData.set("guest_name", args.name);
    formData.set(
      "speed",
      args.speed === "express" || args.speed === "overnight" ? args.speed : "same_day",
    );
    formData.set(
      "lines",
      JSON.stringify([{ catalogItemId: args.catalogItemId, qty }]),
    );
    const posted = await postGuestLaundrySlip({ ok: false }, formData);
    if (!posted.ok) {
      return { ok: false, message: posted.error ?? "Laundry did not post." };
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "ai.desk_action",
      entityType: "folios",
      entityId: folioId,
      summary: `Innora posted laundry for ${args.name}`,
      meta: { kind: "post_bill_addon", addon: "laundry", qty, catalogItemId: args.catalogItemId },
    });
    return {
      ok: true,
      message: `Laundry posted for ${args.name}.`,
      href: posted.printUrl,
    };
  }

  if (args.addon === "service") {
    if (!args.serviceItemId) {
      return { ok: false, message: "Say the service again." };
    }
    const formData = new FormData();
    formData.set("folio_id", folioId);
    formData.set("minibar_item_id", args.serviceItemId);
    formData.set("qty", String(qty));
    const posted = await postMinibarCharge({ ok: false }, formData);
    if (!posted.ok) {
      return { ok: false, message: posted.error ?? "That service did not post." };
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "ai.desk_action",
      entityType: "folios",
      entityId: folioId,
      summary: `Innora posted a service for ${args.name}`,
      meta: { kind: "post_bill_addon", addon: "service", qty, serviceItemId: args.serviceItemId },
    });
    return { ok: true, message: posted.message ?? `Posted for ${args.name}.` };
  }

  return { ok: false, message: "That charge is not available." };
}

export async function runInnoraDeskAction(input: {
  kind: InnoraActionKind;
  bookingId?: string;
  addon?: "mattress" | "laundry" | "service";
  qty?: number;
  speed?: "same_day" | "overnight" | "express";
  catalogItemId?: string;
  serviceItemId?: string;
  roomUnitId?: string;
  roomLabel?: string;
  amountBtn?: number;
  method?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<InnoraRunResult> {
  try {
    const { admin, propertyId } = await requireDeskProperty();
    if (!KINDS.has(input.kind)) {
      return { ok: false, message: "That action is not available." };
    }
    if (input.kind === "close_through_today") {
      return applyDayClose(admin, propertyId);
    }
    if (input.kind === "night_audit") {
      const formData = new FormData();
      formData.set("business_date", await businessDay(admin, propertyId));
      formData.set("notes", "Confirmed in Innora");
      const result = await runNightAudit({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Night audit did not finish." };
      return { ok: true, message: result.message ?? "Night audit finished.", href: "/erp/night-audit" };
    }
    if (input.kind === "reserve_stay") {
      const room = (input.roomLabel ?? "").trim();
      const name = (input.guestName ?? "").trim();
      if (!room || !name || !input.checkIn || !input.checkOut) {
        return { ok: false, message: "Say the guest, the room, and both dates." };
      }
      const { data: units } = await admin
        .from("room_units")
        .select("id, label")
        .eq("property_id", propertyId)
        .ilike("label", room)
        .limit(5);
      const unit = (units ?? []).find(
        (row) => String(row.label).toLowerCase() === room.toLowerCase(),
      );
      if (!unit?.id) return { ok: false, message: `No room ${room} on this hotel.` };
      const formData = new FormData();
      formData.set("source", "reservation");
      formData.set("contact_name", name);
      formData.set("check_in", input.checkIn);
      formData.set("check_out", input.checkOut);
      formData.set("adults", "1");
      formData.set("children", "0");
      formData.set("extra_beds", "0");
      formData.set("guest_origin", "local");
      formData.set("payment_mode", "cash");
      formData.set("meal_plan_code", "EP");
      formData.set("phone_later", "on");
      formData.set("room_unit_ids", unit.id as string);
      formData.set("notes", "Reserved from Innora after confirm.");
      const result = await createCalendarReservation({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Reservation did not save." };
      return {
        ok: true,
        message: result.message ?? `${name} is reserved in room ${room}.`,
        href: "/erp/reservations",
      };
    }
    if (!input.bookingId) {
      return { ok: false, message: "That stay is not on this hotel." };
    }

    const { data: booking } = await admin
      .from("bookings")
      .select("id, property_id, contact_name, status, agent_id, guide_sign_status, payment_mode")
      .eq("id", input.bookingId)
      .maybeSingle();
    if (!booking) return { ok: false, message: "That stay is not on this hotel." };
    assertDeskProperty(propertyId, booking.property_id as string, "Booking");
    const name = String(booking.contact_name ?? "Guest");

    if (input.kind === "show_folio" || input.kind === "open_folio") {
      const folioId = await ensureOpenFolio(
        admin,
        propertyId,
        booking.id as string,
        name,
      );
      await writeAuditEvent(admin, {
        propertyId,
        action: "ai.desk_action",
        entityType: "folios",
        entityId: folioId,
        summary:
          input.kind === "open_folio"
            ? `Innora opened a folio for ${name}`
            : `Innora opened the folio for ${name}`,
        meta: { kind: input.kind, bookingId: booking.id },
      });
      return {
        ok: true,
        message:
          input.kind === "open_folio"
            ? `Folio is open for ${name}.`
            : `Opening the folio for ${name}.`,
        href: `/erp/folios/${folioId}`,
      };
    }

    if (input.kind === "check_in") {
      const { data: assigns } = await admin
        .from("room_assignments")
        .select("room_unit_id")
        .eq("booking_id", booking.id as string);
      const unitIds = (assigns ?? [])
        .map((row) => String(row.room_unit_id ?? ""))
        .filter(Boolean);
      if (!unitIds.length) {
        return { ok: false, message: `Assign a room for ${name} first, then confirm check-in.` };
      }
      const formData = new FormData();
      formData.set("booking_id", booking.id as string);
      formData.set("payment_mode", String(booking.payment_mode ?? "cash") || "cash");
      formData.set("docs_deferred", "on");
      for (const unitId of unitIds) formData.append("room_unit_id", unitId);
      const result = await confirmCheckIn({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Check-in did not finish." };
      return { ok: true, message: `${name} is checked in.`, href: "/erp/in-house" };
    }

    if (input.kind === "cancel_stay") {
      const formData = new FormData();
      formData.set("booking_id", booking.id as string);
      formData.set("cancel_reason_code", "guest_cancelled");
      const result = await cancelBooking({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Cancel did not finish." };
      return { ok: true, message: result.message ?? `${name} is cancelled.`, href: "/erp/reservations" };
    }

    if (input.kind === "move_room") {
      const room = (input.roomLabel ?? "").trim();
      if (!room) return { ok: false, message: "Say the room to move them to." };
      const { data: units } = await admin
        .from("room_units")
        .select("id, label")
        .eq("property_id", propertyId)
        .ilike("label", room)
        .limit(5);
      const unit = (units ?? []).find(
        (row) => String(row.label).toLowerCase() === room.toLowerCase(),
      );
      if (!unit?.id) return { ok: false, message: `No room ${room} on this hotel.` };
      const result = await assignBookingRoomUnit({
        bookingId: booking.id as string,
        roomUnitId: unit.id as string,
      });
      if (!result.ok) return { ok: false, message: result.error ?? "The room did not change." };
      return { ok: true, message: result.message ?? `${name} is now in room ${room}.` };
    }

    if (input.kind === "take_payment") {
      const amount = Number(input.amountBtn);
      const method = input.method ?? "cash";
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: "Say the amount and cash, bank, card, or QR." };
      }
      const folioId = await ensureOpenFolio(admin, propertyId, booking.id as string, name);
      const formData = new FormData();
      formData.set("folio_id", folioId);
      formData.set("method", method);
      formData.set("amount_btn", String(amount));
      formData.set("notes", "Collected from Innora after confirm.");
      const result = await postFolioPayment({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Payment did not post." };
      return { ok: true, message: result.message ?? `Collected Nu ${amount} for ${name}.`, href: `/erp/folios/${folioId}` };
    }

    if (input.kind === "issue_invoice") {
      const folioId = await ensureOpenFolio(admin, propertyId, booking.id as string, name);
      const formData = new FormData();
      formData.set("folio_id", folioId);
      const result = await issueFolioInvoice({ ok: false }, formData);
      if (!result.ok) return { ok: false, message: result.error ?? "Invoice was not issued." };
      return { ok: true, message: result.message ?? `Tax invoice issued for ${name}.`, href: `/erp/folios/${folioId}` };
    }

    if (input.kind === "checkout") {
      const guide = String(booking.guide_sign_status ?? "").toLowerCase();
      if (booking.agent_id && guide !== "photo" && guide !== "signed" && guide !== "waived") {
        await admin
          .from("bookings")
          .update({ guide_sign_status: "waived" })
          .eq("id", booking.id as string)
          .eq("property_id", propertyId);
      }
      const formData = new FormData();
      formData.set("booking_id", booking.id as string);
      const result = await confirmCheckOut({ ok: false }, formData);
      if (!result.ok) {
        return { ok: false, message: result.error ?? "Checkout did not finish." };
      }
      await writeAuditEvent(admin, {
        propertyId,
        action: "ai.desk_action",
        entityType: "bookings",
        entityId: booking.id as string,
        summary: `Innora checked out ${name}`,
        meta: { kind: "checkout" },
      });
      return { ok: true, message: `${name} is checked out.` };
    }

    if (input.kind === "post_bill_addon") {
      return runBillAddon(admin, propertyId, {
        bookingId: booking.id as string,
        name,
        status: String(booking.status ?? ""),
        addon: input.addon,
        qty: input.qty,
        speed: input.speed,
        catalogItemId: input.catalogItemId,
        serviceItemId: input.serviceItemId,
        roomUnitId: input.roomUnitId,
      });
    }

    const { data: folio } = await admin
      .from("folios")
      .select("id, status")
      .eq("booking_id", booking.id as string)
      .eq("status", "open")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!folio?.id) {
      return { ok: false, message: `Open a folio for ${name} first.` };
    }
    const formData = new FormData();
    formData.set("folio_id", folio.id as string);
    const posted = await postFolioRoomNight({ ok: false }, formData);
    if (!posted.ok) {
      return { ok: false, message: posted.error ?? "Room night did not post." };
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "ai.desk_action",
      entityType: "folios",
      entityId: folio.id as string,
      summary: `Innora posted a room night for ${name}`,
      meta: { kind: "post_room_night" },
    });
    return {
      ok: true,
      message: posted.message ?? `Room night posted for ${name}.`,
      href: `/erp/folios/${folio.id as string}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "That did not finish.",
    };
  }
}
