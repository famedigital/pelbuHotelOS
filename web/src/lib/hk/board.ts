export type HkCategory =
  | "check_in"
  | "checkout"
  | "dirty"
  | "service"
  | "stayover"
  | "clean";

export type HkFilterKey =
  | "open"
  | "checkout"
  | "stayover"
  | "dirty"
  | "clean"
  | "check_in"
  | "service"
  | "all";

export const HK_FILTER_LABEL: Record<HkFilterKey, string> = {
  open: "Open work",
  checkout: "Due out",
  stayover: "Stayovers",
  dirty: "Dirty",
  clean: "Clean ready",
  check_in: "Check-in",
  service: "Service",
  all: "All",
};

export const HK_CHIP_ORDER: HkFilterKey[] = [
  "open",
  "checkout",
  "stayover",
  "dirty",
  "clean",
  "check_in",
  "service",
  "all",
];

export type HkBoardRow = {
  id: string;
  roomUnitId: string;
  isPending: boolean;
  roomLabel: string;
  staffName: string | null;
  staffId: string | null;
  status: string;
  notes: string | null;
  cleanOk: boolean;
  linenOk: boolean;
  amenitiesOk: boolean;
  categories: HkCategory[];
};

const WORK_CATEGORIES = new Set<HkCategory>([
  "check_in",
  "checkout",
  "dirty",
  "service",
]);

type RoomUnitSnapshot = {
  id: string;
  label: string;
  hk_status: string;
  service_requested_at: string | null;
};

type AssignmentSnapshot = {
  id: string;
  room_unit_id: string;
  status: string;
  notes: string | null;
  staff_id: string | null;
  checklist_clean_ok: boolean;
  checklist_linen_ok: boolean;
  checklist_amenities_ok: boolean;
  room_label?: string | null;
  staff_name?: string | null;
};

/** Tag why a room needs housekeeping attention today. */
export function buildHkCategories(
  roomUnitId: string,
  hkStatus: string,
  serviceRequestedAt: string | null,
  arrivalRoomIds: ReadonlySet<string>,
  departureRoomIds: ReadonlySet<string>,
  stayoverRoomIds: ReadonlySet<string> = new Set(),
): HkCategory[] {
  const categories: HkCategory[] = [];
  const isArrival = arrivalRoomIds.has(roomUnitId);
  const isDeparture = departureRoomIds.has(roomUnitId);
  const isStayover = stayoverRoomIds.has(roomUnitId);

  if (serviceRequestedAt) categories.push("service");
  if (hkStatus === "dirty" || hkStatus === "inspect" || hkStatus === "ooo") {
    categories.push("dirty");
  }
  if (
    isArrival &&
    (hkStatus === "dirty" || hkStatus === "inspect" || hkStatus === "ooo")
  ) {
    categories.push("check_in");
  }
  if (
    isDeparture &&
    (hkStatus === "dirty" ||
      hkStatus === "occupied" ||
      hkStatus === "inspect" ||
      hkStatus === "ooo")
  ) {
    categories.push("checkout");
  }
  if (isStayover) categories.push("stayover");
  if (hkStatus === "clean" && !isStayover && !isDeparture) {
    categories.push("clean");
  }

  return categories;
}

export function rowHasActionableWork(row: Pick<HkBoardRow, "categories">): boolean {
  return row.categories.some((category) => WORK_CATEGORIES.has(category));
}

export function rowMatchesFilter(
  row: HkBoardRow,
  filter: HkFilterKey,
): boolean {
  if (filter === "clean") {
    return row.categories.includes("clean") && row.status !== "done";
  }
  if (filter === "stayover") {
    return row.categories.includes("stayover") && row.status !== "done";
  }
  if (!rowHasActionableWork(row) && filter !== "all") return false;
  if (filter === "all") {
    return row.categories.length > 0;
  }
  if (filter === "open") {
    if (row.status === "done") return false;
    return rowHasActionableWork(row);
  }
  if (row.status === "done") return false;
  return row.categories.includes(filter as HkCategory);
}

/** Build the actionable HK board — never one row per hotel room by default. */
export function buildHousekeepingBoardRows(input: {
  units: RoomUnitSnapshot[];
  assignments: AssignmentSnapshot[];
  arrivalRoomIds: ReadonlySet<string>;
  departureRoomIds: ReadonlySet<string>;
  stayoverRoomIds?: ReadonlySet<string>;
}): HkBoardRow[] {
  const unitById = new Map(input.units.map((unit) => [unit.id, unit]));
  const openAssignmentRoomIds = new Set<string>();
  const boardRows: HkBoardRow[] = [];
  const stayoverRoomIds = input.stayoverRoomIds ?? new Set<string>();

  for (const assignment of input.assignments) {
    if (assignment.status === "done") continue;

    const unit = unitById.get(assignment.room_unit_id);
    const hkStatus = unit?.hk_status ?? "";
    const serviceRequestedAt = unit?.service_requested_at ?? null;
    const categories = buildHkCategories(
      assignment.room_unit_id,
      hkStatus,
      serviceRequestedAt,
      input.arrivalRoomIds,
      input.departureRoomIds,
      stayoverRoomIds,
    );
    if (categories.length === 0) continue;

    if (assignment.status === "open" || assignment.status === "in_progress") {
      openAssignmentRoomIds.add(assignment.room_unit_id);
    }

    boardRows.push({
      id: assignment.id,
      roomUnitId: assignment.room_unit_id,
      isPending: false,
      roomLabel: assignment.room_label ?? unit?.label ?? "—",
      staffName: assignment.staff_name ?? null,
      staffId: assignment.staff_id,
      status: assignment.status,
      notes: assignment.notes,
      cleanOk: assignment.checklist_clean_ok,
      linenOk: assignment.checklist_linen_ok,
      amenitiesOk: assignment.checklist_amenities_ok,
      categories,
    });
  }

  for (const unit of unitById.values()) {
    if (openAssignmentRoomIds.has(unit.id)) continue;

    const categories = buildHkCategories(
      unit.id,
      unit.hk_status,
      unit.service_requested_at,
      input.arrivalRoomIds,
      input.departureRoomIds,
      stayoverRoomIds,
    );
    if (categories.length === 0) continue;

    boardRows.push({
      id: `pending:${unit.id}`,
      roomUnitId: unit.id,
      isPending: true,
      roomLabel: unit.label,
      staffName: null,
      staffId: null,
      status: "needs_assignment",
      notes: null,
      cleanOk: false,
      linenOk: false,
      amenitiesOk: false,
      categories,
    });
  }

  boardRows.sort((a, b) => {
    const aOpen = a.status !== "done" ? 0 : 1;
    const bOpen = b.status !== "done" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return a.roomLabel.localeCompare(b.roomLabel, undefined, {
      numeric: true,
    });
  });

  return boardRows;
}
