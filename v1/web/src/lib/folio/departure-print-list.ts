import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { isPaymentLine } from "@/lib/folio/ledger-summary";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DeparturePrintItem = {
  folioId: string;
  guest: string;
  rooms: string;
  confirmation: string;
  agent: string;
  /** Posted charges on the open folio, payments left out. */
  amountBtn: number | null;
};

function one<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Checked-in stays leaving on this date, one open folio each. */
export async function loadDeparturePrintList(
  admin: Admin,
  propertyId: string,
  day: string,
): Promise<DeparturePrintItem[]> {
  const { data, error } = await admin
    .from("bookings")
    .select(
      `contact_name, confirmation_code,
       agents(company_name),
       room_assignments(room_units(label)),
       folios(id, status, folio_lines(id, total_btn, status, source_type, reverses_line_id))`,
    )
    .eq("property_id", propertyId)
    .eq("status", "checked_in")
    .eq("check_out", day)
    .order("contact_name")
    .limit(80);
  if (error || !data) return [];

  const items: DeparturePrintItem[] = [];
  for (const row of data) {
    const folios =
      (row.folios as Array<{
        id?: string;
        status?: string;
        folio_lines?: Array<{
          id?: string;
          total_btn?: number;
          status?: string;
          source_type?: string;
          reverses_line_id?: string | null;
        }> | null;
      }> | null) ?? [];
    const folio = folios.find((item) => item.status === "open") ?? folios[0];
    if (!folio?.id) continue;
    const visible = guestVisibleBalanceLines(
      (folio.folio_lines ?? []).map((line, index) => ({
        id: line.id ?? `tmp-${index}`,
        status: line.status ?? "posted",
        total_btn: Number(line.total_btn ?? 0),
        reverses_line_id: line.reverses_line_id ?? null,
        source_type: line.source_type ?? "",
      })),
    );
    const amountBtn = visible
      .filter((line) => !isPaymentLine(line.source_type))
      .reduce((sum, line) => sum + Number(line.total_btn), 0);
    const agent = one(
      row.agents as
        | { company_name?: string | null }
        | { company_name?: string | null }[]
        | null,
    );
    const rooms = [
      ...new Set(
        ((row.room_assignments as Array<{
          room_units?: { label?: string | null } | { label?: string | null }[] | null;
        }> | null) ?? [])
          .map((assignment) => one(assignment.room_units)?.label?.trim() ?? "")
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    items.push({
      folioId: folio.id,
      guest: (row.contact_name as string | null)?.trim() || "Guest",
      rooms: rooms.join(", "),
      confirmation: (row.confirmation_code as string | null)?.trim() || "",
      agent: agent?.company_name?.trim() || "",
      amountBtn: Number.isFinite(amountBtn) ? amountBtn : null,
    });
  }
  items.sort((a, b) =>
    (a.rooms || a.guest).localeCompare(b.rooms || b.guest, undefined, { numeric: true }),
  );
  return items;
}
