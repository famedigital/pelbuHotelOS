/**
 * Build StayHub seed from board / rooming rows so chrome paints before summary RTT.
 * Same shape as rack `RackStay` / `StayHubSeedStay`.
 */

import type { RackStay } from "@/components/erp/RoomRackGrid";

export type StayHubBoardSeedInput = {
  id: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  status?: string | null;
  adults?: number | null;
  rooms?: number | null;
  room_labels?: string | null;
  assigned_count?: number;
  agent_id?: string | null;
  agent_name?: string | null;
  source?: string | null;
  payment_mode?: string | null;
  folio_id?: string | null;
  folio_balance?: number | null;
  badges?: Array<{ key: string }>;
};

export type StayHubRoomingSeedInput = {
  bookingId: string;
  contactName?: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  roomsSold?: number;
  adults?: number;
  assignmentId?: string | null;
  roomUnitId?: string | null;
  roomLabel?: string | null;
  roomTypeId?: string | null;
  roomTypeName?: string | null;
};

function firstRoomLabel(labels: string | null | undefined): string {
  if (!labels?.trim()) return "";
  return labels.split(",")[0]?.trim() ?? "";
}

/** Board / arrivals / reservations row → StayHub seed. */
export function seedStayFromBoardRow(row: StayHubBoardSeedInput): RackStay {
  const checkIn = row.check_in ?? "";
  const checkOut = row.check_out ?? "";
  const hasRoom =
    Boolean(row.room_labels?.trim()) || (row.assigned_count ?? 0) > 0;
  return {
    id: `seed-${row.id}`,
    booking_id: row.id,
    room_unit_id: hasRoom ? "seed-assigned" : "",
    from_date: checkIn,
    to_date: checkOut,
    is_locked: false,
    lock_reason: null,
    contact_name: row.contact_name ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_email: row.contact_email ?? null,
    status: row.status ?? "confirmed",
    check_in: checkIn,
    check_out: checkOut,
    adults: row.adults ?? 1,
    rooms: row.rooms ?? 1,
    guide_number: null,
    agent_id: row.agent_id ?? null,
    payment_mode: row.payment_mode ?? null,
    source: row.source ?? null,
    booked_by_role: null,
    guest_origin: null,
    notes: null,
    agent_name: row.agent_name ?? null,
    group_name: null,
    folio_id: row.folio_id ?? null,
    folio_balance: Number(row.folio_balance ?? 0),
    room_label: firstRoomLabel(row.room_labels),
    room_type_id: "",
    room_type_name: "",
    sdf_incomplete: row.badges?.some((b) => b.key === "sdf") ?? false,
  };
}

/** Rooming-list line → StayHub seed. */
export function seedStayFromRoomingLine(line: StayHubRoomingSeedInput): RackStay {
  const unitId = line.roomUnitId ?? "";
  return {
    id: line.assignmentId ?? `seed-${line.bookingId}`,
    booking_id: line.bookingId,
    room_unit_id: unitId || (line.roomLabel ? "seed-assigned" : ""),
    from_date: line.checkIn,
    to_date: line.checkOut,
    is_locked: false,
    lock_reason: null,
    contact_name: line.contactName ?? null,
    contact_phone: null,
    contact_email: null,
    status: line.status,
    check_in: line.checkIn,
    check_out: line.checkOut,
    adults: line.adults ?? 1,
    rooms: line.roomsSold ?? 1,
    guide_number: null,
    agent_id: null,
    payment_mode: null,
    source: null,
    booked_by_role: null,
    guest_origin: null,
    notes: null,
    agent_name: null,
    group_name: null,
    folio_id: null,
    folio_balance: 0,
    room_label: line.roomLabel?.trim() ?? "",
    room_type_id: line.roomTypeId ?? "",
    room_type_name: line.roomTypeName ?? "",
  };
}
