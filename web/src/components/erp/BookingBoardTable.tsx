import { BookingsTable, type BookingRow, type BoardKind } from "@/components/erp/BookingsTable";
import {
  boardActionLabel,
  computeArrivalBadges,
} from "@/lib/arrival-board";

/**
 * Server-rendered adapter that maps raw booking query rows into the typed
 * `BookingsTable` shape. Used by arrivals / in-house / departures boards.
 */
export function BookingBoardTable({
  rows,
  board = "auto",
}: {
  rows: Record<string, unknown>[];
  board?: BoardKind;
}) {
  const data: BookingRow[] = rows.map((r) => {
    const agent = r.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentName = Array.isArray(agent)
      ? (agent[0]?.company_name ?? null)
      : (agent?.company_name ?? null);

    const assigns =
      (r.room_assignments as
        | Array<{
            room_units:
              | {
                  label?: string;
                  hk_status?: string;
                  room_types?:
                    | { inventory_kind?: string }
                    | { inventory_kind?: string }[]
                    | null;
                }
              | {
                  label?: string;
                  hk_status?: string;
                  room_types?:
                    | { inventory_kind?: string }
                    | { inventory_kind?: string }[]
                    | null;
                }[]
              | null;
          }>
        | null) ?? [];

    const labels: string[] = [];
    let dirtyOrOoo = false;
    let unreadyGuest = false;
    for (const a of assigns) {
      const unit = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
      if (!unit) continue;
      if (unit.label) labels.push(unit.label);
      const hk = unit.hk_status ?? "";
      if (hk === "dirty" || hk === "ooo" || hk === "inspect") {
        dirtyOrOoo = true;
      }
      const rt = Array.isArray(unit.room_types)
        ? unit.room_types[0]
        : unit.room_types;
      if (
        (rt?.inventory_kind ?? "sellable_guest") === "sellable_guest" &&
        !["clean", "inspect", "occupied"].includes(hk)
      ) {
        unreadyGuest = true;
      }
    }

    const folios =
      (r.folios as
        | Array<{
            status?: string;
            folio_lines?: Array<{ total_btn?: number; status?: string }> | null;
          }>
        | null) ?? [];
    const openFolio = folios.find((f) => f.status === "open") ?? folios[0];
    const folioBalance = openFolio
      ? (openFolio.folio_lines ?? [])
          .filter((l) => l.status === "posted")
          .reduce((sum, l) => sum + Number(l.total_btn ?? 0), 0)
      : null;

    const badges = computeArrivalBadges({
      status: (r.status as string) ?? null,
      guest_origin: (r.guest_origin as string) ?? null,
      guide_number: (r.guide_number as string) ?? null,
      payment_mode: (r.payment_mode as string) ?? null,
      token_required_btn:
        r.token_required_btn != null ? Number(r.token_required_btn) : null,
      token_received_btn:
        r.token_received_btn != null ? Number(r.token_received_btn) : null,
      rooms: (r.rooms as number) ?? null,
      assigned_count: assigns.length,
      room_labels: labels,
      dirty_or_ooo: dirtyOrOoo,
      has_unready_guest_room: unreadyGuest,
      folio_balance_btn: folioBalance,
    });

    return {
      id: r.id as string,
      contact_name: (r.contact_name as string) ?? null,
      contact_phone: (r.contact_phone as string) ?? null,
      check_in: (r.check_in as string) ?? null,
      check_out: (r.check_out as string) ?? null,
      source: (r.source as string) ?? null,
      agent_name: agentName,
      adults: (r.adults as number) ?? null,
      rooms: (r.rooms as number) ?? null,
      status: (r.status as string) ?? null,
      room_labels: labels.length ? labels.join(", ") : null,
      badges,
      action_label: boardActionLabel((r.status as string) ?? null),
    };
  });

  return (
    <BookingsTable
      data={data}
      caption="Board"
      emptyMessage="None for this board."
      board={board}
    />
  );
}
